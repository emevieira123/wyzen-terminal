import type { AgentMessage } from "@/lib/agents"
import type { Pane, Tab, WorkspaceState } from "@/state/types"

/**
 * Sessão salva entre aberturas do app: abas, painéis, nomes, diretórios,
 * tamanhos do grid e conversas dos agentes. Os processos dos terminais não
 * voltam; cada terminal reabre um shell novo no diretório salvo.
 */
const SESSION_KEY = "wyzen-terminal:session:v1"

export interface SavedSession {
  tabs: Tab[]
  panes: Record<string, Pane>
  activeProjectId: string
  activeTabByProject: Record<string, string | null>
}

/** Respostas sem os blocos crus do provedor: grandes e só úteis na conversa original. */
function slimMessage(message: AgentMessage): AgentMessage {
  return message.role === "assistant" ? { ...message, raw: undefined } : message
}

function slimPane(pane: Pane): Pane {
  if (pane.kind === "terminal") return pane
  // Sem os blocos crus, o system prompt fixo não precisa mais ser preservado.
  return { ...pane, thinking: false, messages: pane.messages.map(slimMessage), systemPrompt: undefined }
}

export function saveSession(state: WorkspaceState) {
  const session: SavedSession = {
    tabs: state.tabs.map((tab) => ({ ...tab, attention: false })),
    panes: Object.fromEntries(Object.entries(state.panes).map(([id, pane]) => [id, slimPane(pane)])),
    activeProjectId: state.activeProjectId,
    activeTabByProject: state.activeTabByProject,
  }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Cota do storage estourada (conversas longas): segue sem salvar desta vez.
  }
}

/** Sessão salva, descartando o que aponta para projetos que não existem mais. */
export function loadSession(projectIds: string[]): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as SavedSession
    const known = new Set(projectIds)
    const tabs = session.tabs.filter((t) => known.has(t.projectId))
    const paneIds = new Set(tabs.flatMap((t) => t.paneIds))
    const panes = Object.fromEntries(Object.entries(session.panes).filter(([id]) => paneIds.has(id)))
    const activeTabByProject = Object.fromEntries(
      Object.entries(session.activeTabByProject).filter(
        ([projectId, tabId]) => known.has(projectId) && (tabId === null || tabs.some((t) => t.id === tabId)),
      ),
    )
    return {
      tabs,
      panes,
      activeProjectId: known.has(session.activeProjectId) ? session.activeProjectId : projectIds[0],
      activeTabByProject,
    }
  } catch {
    return null
  }
}
