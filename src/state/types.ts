import type { AgentMessage } from "@/lib/agents"

export type ThemeName = "dark" | "light"

export interface Project {
  id: string
  name: string
  path: string
  color: string
}

export interface Workflow {
  id: string
  name: string
  cmd: string
}

export interface Settings {
  theme: ThemeName
  modelId: string
  showWorkflows: boolean
}

interface PaneBase {
  id: string
  projectId: string
  cwd: string
  title: string
}

export interface TerminalPane extends PaneBase {
  kind: "terminal"
}

export interface AgentPane extends PaneBase {
  kind: "agent"
  messages: AgentMessage[]
  thinking: boolean
}

export type Pane = TerminalPane | AgentPane
export type PaneKind = Pane["kind"]

export interface Tab {
  id: string
  projectId: string
  kind: PaneKind | "grid"
  title: string
  paneIds: string[]
  focusedPaneId: string | null
}

export interface WorkspaceState {
  projects: Project[]
  workflows: Workflow[]
  settings: Settings
  panes: Record<string, Pane>
  tabs: Tab[]
  activeProjectId: string
  activeTabByProject: Record<string, string | null>
  shell: string
}

export const GRID_LIMIT = 6
