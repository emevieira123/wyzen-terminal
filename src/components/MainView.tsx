import { AgentView } from "@/components/AgentView"
import { GridView } from "@/components/GridView"
import { TerminalView } from "@/components/TerminalView"
import { Button } from "@/components/ui/button"
import { shortcutLabel } from "@/lib/platform"
import { activeProject, activeTab } from "@/state/workspace-reducer"
import { useWorkspace } from "@/state/workspace-context"

export function MainView() {
  const { state } = useWorkspace()
  const tab = activeTab(state)

  if (!tab) return <EmptyState />

  if (tab.kind === "grid") return <GridView key={tab.id} tab={tab} />

  const pane = state.panes[tab.paneIds[0]]
  if (!pane) return <EmptyState />

  return pane.kind === "terminal" ? (
    <TerminalView key={pane.id} paneId={pane.id} cwd={pane.cwd} className="px-5 pt-4 pb-3" />
  ) : (
    <AgentView key={pane.id} pane={pane} />
  )
}

function EmptyState() {
  const { state, dispatch } = useWorkspace()
  const project = activeProject(state)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <div className="font-mono text-[34px] text-input">❯_</div>
      <div className="text-[15px] text-foreground">{project?.name}</div>
      <div className="text-[13px]">Nenhuma sessão aberta neste projeto</div>
      <div className="mt-1.5 flex gap-2">
        <Button onClick={() => dispatch({ type: "tab/new", kind: "terminal" })}>Novo terminal</Button>
        <Button variant="outline" onClick={() => dispatch({ type: "tab/new", kind: "agent" })}>
          Novo agente ✦
        </Button>
      </div>
      <div className="mt-2.5 flex gap-4 text-xs text-dim">
        <span>{shortcutLabel("T")} terminal</span>
        <span>{shortcutLabel("A", { shift: true })} agente</span>
        <span>{shortcutLabel("K")} paleta</span>
      </div>
    </div>
  )
}
