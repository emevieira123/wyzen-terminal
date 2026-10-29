import { useEffect, useState, type FormEvent } from "react"
import { getVersion } from "@tauri-apps/api/app"

import { AiSettings } from "@/components/dialogs/AiSettings"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { checkForUpdates } from "@/lib/updater"
import { cn } from "@/lib/utils"
import type { ThemeName, Workflow } from "@/state/types"
import { newId } from "@/state/workspace-reducer"
import { useWorkspace } from "@/state/workspace-context"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const THEMES: { value: ThemeName; label: string }[] = [
  { value: "dark", label: "Escuro" },
  { value: "light", label: "Claro" },
]

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { state, dispatch } = useWorkspace()
  const { settings } = state
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(null))
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
        </DialogHeader>

        <section className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Tema</span>
          <div className="flex gap-1.5">
            {THEMES.map((theme) => (
              <Button
                key={theme.value}
                variant="outline"
                size="sm"
                className={cn(settings.theme === theme.value && "border-primary text-primary")}
                onClick={() => dispatch({ type: "settings/update", patch: { theme: theme.value } })}
              >
                {theme.label}
              </Button>
            ))}
          </div>
        </section>

        <Separator />

        <AiSettings />

        <Separator />

        <section className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Avisos dos terminais</span>
          <p className="text-xs text-dim">
            Quando um programa no terminal avisa algo (ex.: o Claude Code terminou ou pede aprovação) e você não está
            olhando aquela aba.
          </p>
          <Label className="text-[13px] font-normal">
            <Switch
              checked={settings.alertSound}
              onCheckedChange={(alertSound) => dispatch({ type: "settings/update", patch: { alertSound } })}
            />
            Tocar som
          </Label>
          <Label className="text-[13px] font-normal">
            <Switch
              checked={settings.alertSystem}
              onCheckedChange={(alertSystem) => dispatch({ type: "settings/update", patch: { alertSystem } })}
            />
            Notificação do sistema com a janela fora de foco
          </Label>
        </section>

        <Separator />

        <section className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-muted-foreground">Workflows</span>
            <Label className="ml-auto text-[13px] font-normal">
              <Switch
                checked={settings.showWorkflows}
                onCheckedChange={(showWorkflows) =>
                  dispatch({ type: "settings/update", patch: { showWorkflows } })
                }
              />
              Exibir no sidebar
            </Label>
          </div>
          <WorkflowEditor workflows={state.workflows} />
        </section>

        <Separator />

        <footer className="flex items-center gap-4 text-xs text-dim">
          <span>Versão {version ?? "…"}</span>
          <span>Shell: {state.shell}</span>
          <span>Tauri 2 · xterm.js</span>
          <Button
            variant="link"
            size="xs"
            className="ml-auto text-dim"
            onClick={() => void checkForUpdates({ manual: true })}
          >
            Verificar atualizações
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

function WorkflowEditor({ workflows }: { workflows: Workflow[] }) {
  const { dispatch } = useWorkspace()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [cmd, setCmd] = useState("")

  function reset() {
    setEditingId(null)
    setName("")
    setCmd("")
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !cmd.trim()) return
    dispatch({
      type: "workflow/save",
      workflow: { id: editingId ?? newId(), name: name.trim(), cmd: cmd.trim() },
    })
    reset()
  }

  return (
    <>
      {workflows.length > 0 && (
        <ul className="flex max-h-40 flex-col gap-0.5 overflow-auto">
          {workflows.map((w) => (
            <li
              key={w.id}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] hover:bg-accent",
                editingId === w.id && "bg-accent",
              )}
            >
              <span className="min-w-28 font-mono text-[12.5px]">{w.name}</span>
              <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{w.cmd}</span>
              <Button
                variant="link"
                size="xs"
                className="text-dim"
                onClick={() => {
                  setEditingId(w.id)
                  setName(w.name)
                  setCmd(w.cmd)
                }}
              >
                Editar
              </Button>
              <Button
                variant="link"
                size="xs"
                className="text-dim hover:text-destructive"
                onClick={() => {
                  dispatch({ type: "workflow/remove", workflowId: w.id })
                  if (editingId === w.id) reset()
                }}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="nome"
          aria-label="Nome do workflow"
          className="w-36 font-mono text-[12.5px]"
        />
        <Input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="comando, ex.: pnpm test --watch"
          aria-label="Comando do workflow"
          className="flex-1 font-mono text-[12.5px]"
        />
        <Button type="submit" variant="outline" size="sm" disabled={!name.trim() || !cmd.trim()}>
          {editingId ? "Salvar" : "Adicionar"}
        </Button>
        {editingId && (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            Cancelar
          </Button>
        )}
      </form>
    </>
  )
}
