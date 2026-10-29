import type { AgentMessage, ProviderId } from "@/lib/agents"

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
  /** Modelo padrão dos novos agentes; o provedor em uso é o deste modelo. */
  modelId: string
  showWorkflows: boolean
  /** Modelos encontrados na conta de cada provedor ("Atualizar modelos"). */
  discoveredModels: Partial<Record<ProviderId, string[]>>
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
  /** Modelo deste chat; sem valor, usa o padrão das configurações. */
  modelId?: string
  /**
   * System prompt fixado na primeira mensagem. Mudá-lo depois invalidaria os
   * blocos de thinking já recebidos, então mudanças de contexto vão nas
   * mensagens do usuário.
   */
  systemPrompt?: string
  /** Último contexto (diretório, branch) enviado ao modelo. */
  lastContext?: string
}

export type AgentPatch = Partial<Pick<AgentPane, "modelId" | "systemPrompt" | "lastContext">>

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
