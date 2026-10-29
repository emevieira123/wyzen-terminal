import { useState } from "react"
import { LayoutGrid, Pencil, X } from "lucide-react"

import { AgentView } from "@/components/AgentView"
import { PaneIcon } from "@/components/PaneIcon"
import { RenameField } from "@/components/RenameField"
import { TerminalView } from "@/components/TerminalView"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"
import { GRID_LIMIT, type Tab } from "@/state/types"
import { useWorkspace } from "@/state/workspace-context"

/**
 * 1-2 painéis: uma linha. 3-4: duas colunas. 5-6: três colunas. A linha de
 * baixo pode ter um painel a menos e ainda ocupa a largura toda, então as
 * colunas da grade são o MMC das duas linhas e cada painel ocupa a fração dele.
 */
function gridLayout(count: number) {
  const top = count <= 2 ? count : count <= 4 ? 2 : 3
  const bottom = count - top
  const columns = bottom === 0 || bottom === top ? top : top * bottom
  return {
    rows: bottom === 0 ? 1 : 2,
    columns,
    top,
    span: (index: number) => (index < top ? columns / top : columns / bottom),
  }
}

export function GridView({ tab }: { tab: Tab }) {
  const { state, dispatch } = useWorkspace()
  const panes = tab.paneIds.map((id) => state.panes[id]).filter((p) => p !== undefined)
  const full = panes.length >= GRID_LIMIT
  const layout = gridLayout(panes.length)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <LayoutGrid className="size-3.5" />
          Grid
        </span>
        <span>
          {panes.length} {panes.length === 1 ? "painel" : "painéis"}
          {layout.rows === 2 && ` · ${layout.top} em cima, ${panes.length - layout.top} embaixo`}
        </span>
        {full && (
          <Badge variant="outline" className="border-warning/40 text-warning">
            limite de {GRID_LIMIT} atingido
          </Badge>
        )}
        <div className="ml-auto flex gap-1.5">
          <Button
            variant="outline"
            size="xs"
            disabled={full}
            onClick={() => dispatch({ type: "pane/addToGrid", tabId: tab.id, kind: "terminal" })}
          >
            <PaneIcon kind="terminal" />+ Terminal
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={full}
            onClick={() => dispatch({ type: "pane/addToGrid", tabId: tab.id, kind: "agent" })}
          >
            <PaneIcon kind="agent" />+ Agente
          </Button>
        </div>
      </div>

      {panes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 text-[13px] text-muted-foreground">
          <LayoutGrid className="size-8 text-input" />
          Grid vazio · adicione até {GRID_LIMIT} terminais ou agentes
        </div>
      ) : (
        <div
          className="grid min-h-0 flex-1 gap-2.5 p-3"
          style={{
            gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
          }}
        >
          {panes.map((pane, index) => {
            const focused = (tab.focusedPaneId ?? tab.paneIds[0]) === pane.id
            return (
              <section
                key={pane.id}
                style={{ gridColumn: `span ${layout.span(index)}` }}
                onMouseDownCapture={() => {
                  if (!focused) dispatch({ type: "pane/focus", tabId: tab.id, paneId: pane.id })
                }}
                className={cn(
                  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border bg-chrome",
                  focused && "border-primary",
                )}
              >
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <header className="flex items-center gap-2 border-b bg-panel px-2.5 py-1.5 text-xs text-muted-foreground">
                      <PaneIcon kind={pane.kind} />
                      {renamingId === pane.id ? (
                        <RenameField
                          initial={pane.title}
                          onDone={(title) => {
                            setRenamingId(null)
                            if (title !== null) dispatch({ type: "pane/rename", paneId: pane.id, title })
                          }}
                          className="flex items-center"
                        />
                      ) : (
                        <span
                          className="text-foreground"
                          title="Duplo clique ou botão direito para renomear"
                          onDoubleClick={() => setRenamingId(pane.id)}
                        >
                          {pane.title}
                        </span>
                      )}
                      <span className="min-w-0 truncate font-mono text-[11px]">{pane.cwd}</span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="ml-auto text-dim"
                        aria-label="Fechar painel"
                        onClick={() => dispatch({ type: "pane/close", tabId: tab.id, paneId: pane.id })}
                      >
                        <X />
                      </Button>
                    </header>
                  </ContextMenuTrigger>
                  {/* Sem devolver o foco ao cabeçalho: ele precisa ir para o campo de renomear. */}
                  <ContextMenuContent className="w-44" onCloseAutoFocus={(event) => event.preventDefault()}>
                    <ContextMenuItem onSelect={() => setRenamingId(pane.id)}>
                      <Pencil />
                      Renomear
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() => dispatch({ type: "pane/close", tabId: tab.id, paneId: pane.id })}
                    >
                      <X />
                      Fechar painel
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                <div className="min-h-0 flex-1">
                  {pane.kind === "terminal" ? (
                    <TerminalView paneId={pane.id} cwd={pane.cwd} focused={focused} className="p-2" />
                  ) : (
                    <AgentView pane={pane} compact />
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
