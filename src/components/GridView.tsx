import { Fragment, useState } from "react"
import { LayoutGrid, Pencil, X } from "lucide-react"
import { Separator } from "react-resizable-panels"

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
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import { GRID_LIMIT, type Pane, type Tab } from "@/state/types"
import { useWorkspace } from "@/state/workspace-context"

/** Tamanho mínimo de um painel, em pixels, ao redimensionar. */
const MIN_PANE_WIDTH = 180
const MIN_ROW_HEIGHT = 110

/**
 * Divide os painéis em linhas: 1-2 painéis numa linha; 3-4 em duas colunas;
 * 5-6 em três colunas. A linha de baixo pode ter um painel a menos e ocupa a
 * largura toda do mesmo jeito.
 */
function splitRows<T>(items: T[]): T[][] {
  const top = items.length <= 2 ? items.length : items.length <= 4 ? 2 : 3
  return [items.slice(0, top), items.slice(top)].filter((row) => row.length > 0)
}

/** Fatia igual em porcentagem; é para onde o duplo clique na divisória volta. */
const equalShare = (count: number) => `${100 / count}%`

/** Divisória invisível no espaço entre os painéis; mostra uma linha ao passar o mouse ou arrastar. */
function GridDivider() {
  return <Separator className="grid-divider" />
}

export function GridView({ tab }: { tab: Tab }) {
  const { state, dispatch } = useWorkspace()
  const panes = tab.paneIds.map((id) => state.panes[id]).filter((p) => p !== undefined)
  const full = panes.length >= GRID_LIMIT
  const rows = splitRows(panes)
  // Adicionar ou fechar um painel recompõe as linhas; os tamanhos voltam a ser iguais.
  const layoutKey = panes.map((p) => p.id).join(",")
  // Guardados na aba para a sessão restaurar o grid como estava.
  const saveLayout = (key: string, layout: Record<string, number>) =>
    dispatch({ type: "tab/layout", tabId: tab.id, key, layout })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <LayoutGrid className="size-3.5" />
          Grid
        </span>
        <span>
          {panes.length} {panes.length === 1 ? "painel" : "painéis"}
          {rows.length === 2 && ` · ${rows[0].length} em cima, ${rows[1].length} embaixo`}
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
        <div className="min-h-0 flex-1 p-3">
          <ResizablePanelGroup
            key={layoutKey}
            orientation="vertical"
            defaultLayout={tab.layouts?.[`${layoutKey}|rows`]}
            onLayoutChanged={(layout) => saveLayout(`${layoutKey}|rows`, layout)}
          >
            {rows.map((row, r) => (
              <Fragment key={r}>
                {r > 0 && <GridDivider />}
                <ResizablePanel id={`row-${r}`} defaultSize={equalShare(rows.length)} minSize={MIN_ROW_HEIGHT}>
                  <ResizablePanelGroup
                    orientation="horizontal"
                    defaultLayout={tab.layouts?.[`${layoutKey}|row-${r}`]}
                    onLayoutChanged={(layout) => saveLayout(`${layoutKey}|row-${r}`, layout)}
                  >
                    {row.map((pane, i) => (
                      <Fragment key={pane.id}>
                        {i > 0 && <GridDivider />}
                        <ResizablePanel id={pane.id} defaultSize={equalShare(row.length)} minSize={MIN_PANE_WIDTH}>
                          <PaneCard tab={tab} pane={pane} />
                        </ResizablePanel>
                      </Fragment>
                    ))}
                  </ResizablePanelGroup>
                </ResizablePanel>
              </Fragment>
            ))}
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  )
}

function PaneCard({ tab, pane }: { tab: Tab; pane: Pane }) {
  const { dispatch } = useWorkspace()
  const [renaming, setRenaming] = useState(false)
  const focused = (tab.focusedPaneId ?? tab.paneIds[0]) === pane.id
  const close = () => dispatch({ type: "pane/close", tabId: tab.id, paneId: pane.id })

  return (
    <section
      onMouseDownCapture={() => {
        if (!focused) dispatch({ type: "pane/focus", tabId: tab.id, paneId: pane.id })
      }}
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border bg-chrome",
        focused && "border-primary",
      )}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <header className="flex items-center gap-2 border-b bg-panel px-2.5 py-1.5 text-xs text-muted-foreground">
            <PaneIcon kind={pane.kind} />
            {renaming ? (
              <RenameField
                initial={pane.title}
                onDone={(title) => {
                  setRenaming(false)
                  if (title !== null) dispatch({ type: "pane/rename", paneId: pane.id, title })
                }}
                className="flex items-center"
              />
            ) : (
              <span
                className="text-foreground"
                title="Duplo clique ou botão direito para renomear"
                onDoubleClick={() => setRenaming(true)}
              >
                {pane.title}
              </span>
            )}
            <span className="min-w-0 truncate font-mono text-[11px]">{pane.cwd}</span>
            <Button variant="ghost" size="icon-xs" className="ml-auto text-dim" aria-label="Fechar painel" onClick={close}>
              <X />
            </Button>
          </header>
        </ContextMenuTrigger>
        {/* Sem devolver o foco ao cabeçalho: ele precisa ir para o campo de renomear. */}
        <ContextMenuContent className="w-44" onCloseAutoFocus={(event) => event.preventDefault()}>
          <ContextMenuItem onSelect={() => setRenaming(true)}>
            <Pencil />
            Renomear
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={close}>
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
}
