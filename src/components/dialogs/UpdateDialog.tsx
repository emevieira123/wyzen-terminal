import { useEffect, useState } from "react"
import type { Update } from "@tauri-apps/plugin-updater"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isWindows } from "@/lib/platform"
import { ptyStatus } from "@/lib/pty"
import { terminalRegistry } from "@/lib/terminal-registry"
import { dismissUpdateRequest, installForNextLaunch, restartNow, useRequestedUpdate } from "@/lib/updater"
import type { WorkspaceState } from "@/state/types"
import { useWorkspace } from "@/state/workspace-context"

interface BusyTerminal {
  place: string
  command: string | null
}

/** Nome legível de um painel: "projeto / aba › painel". */
function placeOf(state: WorkspaceState, paneId: string): string | null {
  const tab = state.tabs.find((t) => t.paneIds.includes(paneId))
  const pane = state.panes[paneId]
  if (!tab || !pane) return null
  const project = state.projects.find((p) => p.id === tab.projectId)
  const place = tab.kind === "grid" ? `${tab.title} › ${pane.title}` : tab.title
  return state.projects.length > 1 && project ? `${project.name} / ${place}` : place
}

/** Terminais que perderiam algo ao reiniciar. No Windows não dá para saber; todos contam. */
async function busyTerminals(state: WorkspaceState): Promise<BusyTerminal[]> {
  if (isWindows) {
    return Object.values(state.panes)
      .filter((pane) => pane.kind === "terminal")
      .flatMap((pane) => {
        const place = placeOf(state, pane.id)
        return place ? [{ place, command: null }] : []
      })
  }
  const statuses = await ptyStatus().catch(() => [])
  return statuses.flatMap(({ sessionId, running }) => {
    const paneId = running ? terminalRegistry.paneOfSession(sessionId) : undefined
    const place = paneId ? placeOf(state, paneId) : null
    return place ? [{ place, command: running }] : []
  })
}

/** Confirmação antes de reiniciar para atualizar, quando há programas rodando. */
export function UpdateDialog() {
  const { state } = useWorkspace()
  const update = useRequestedUpdate()
  const [busy, setBusy] = useState<{ update: Update; terminals: BusyTerminal[] } | null>(null)

  useEffect(() => {
    if (!update) {
      setBusy(null)
      return
    }
    let cancelled = false
    void busyTerminals(state).then((terminals) => {
      if (cancelled) return
      // Nada rodando: a sessão volta inteira, então reinicia sem perguntar.
      if (terminals.length === 0) void restartNow(update)
      else setBusy({ update, terminals })
    })
    return () => {
      cancelled = true
    }
    // Só reavalia quando um novo pedido de atualização chega.
  }, [update])

  return (
    <Dialog open={busy !== null} onOpenChange={(open) => !open && dismissUpdateRequest()}>
      <DialogContent className="sm:max-w-md">
        {busy && (
          <>
            <DialogHeader>
              <DialogTitle>Atualizar para a versão {busy.update.version}</DialogTitle>
              <DialogDescription>
                {isWindows
                  ? "O instalador fecha o Wyzen. Estes terminais serão encerrados:"
                  : "Estes terminais têm programas rodando e serão encerrados ao reiniciar:"}
              </DialogDescription>
            </DialogHeader>
            <ul className="flex flex-col gap-1 text-[13px]">
              {busy.terminals.map((terminal) => (
                <li key={terminal.place} className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5">
                  <span className="truncate">{terminal.place}</span>
                  {terminal.command && (
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{terminal.command}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Abas, nomes, pastas e o grid voltam como estão. Os programas precisam ser iniciados de novo.
            </p>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={dismissUpdateRequest}>
                Cancelar
              </Button>
              <div className="flex gap-2">
                {!isWindows && (
                  <Button variant="outline" onClick={() => void installForNextLaunch(busy.update)}>
                    Instalar e usar depois
                  </Button>
                )}
                <Button variant="destructive" onClick={() => void restartNow(busy.update)}>
                  Reiniciar agora
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
