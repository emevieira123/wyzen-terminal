import type { AgentMessage } from "@/lib/agents"
import {
  GRID_LIMIT,
  type AgentPatch,
  type Pane,
  type PaneKind,
  type Project,
  type Settings,
  type Tab,
  type Workflow,
  type WorkspaceState,
} from "@/state/types"

export type WorkspaceAction =
  | { type: "project/add"; name: string; path: string }
  | { type: "project/remove"; projectId: string }
  | { type: "project/select"; projectId: string }
  | { type: "tab/new"; kind: PaneKind; paneId?: string }
  | { type: "tab/newGrid" }
  | { type: "tab/groupIntoGrid" }
  | { type: "tab/select"; tabId: string }
  | { type: "tab/close"; tabId: string }
  | { type: "tab/rename"; tabId: string; title: string }
  | { type: "tab/attention"; paneId: string }
  | { type: "pane/addToGrid"; tabId: string; kind: PaneKind }
  | { type: "pane/focus"; tabId: string; paneId: string }
  | { type: "pane/close"; tabId: string; paneId: string }
  | { type: "pane/setCwd"; paneId: string; cwd: string }
  | { type: "pane/rename"; paneId: string; title: string }
  | { type: "agent/append"; paneId: string; message: AgentMessage }
  | { type: "agent/thinking"; paneId: string; thinking: boolean }
  | { type: "agent/update"; paneId: string; patch: AgentPatch }
  | { type: "settings/update"; patch: Partial<Settings> }
  | { type: "workflow/save"; workflow: Workflow }
  | { type: "workflow/remove"; workflowId: string }
  | { type: "shell/set"; shell: string }

const PROJECT_HUES = [250, 160, 75, 330, 25, 200]

export const newId = (): string => crypto.randomUUID()

export function projectColor(index: number): string {
  return `oklch(0.72 0.15 ${PROJECT_HUES[index % PROJECT_HUES.length]})`
}

export function activeTab(state: WorkspaceState): Tab | undefined {
  const tabId = state.activeTabByProject[state.activeProjectId]
  return state.tabs.find((t) => t.id === tabId)
}

export function activeProject(state: WorkspaceState): Project | undefined {
  return state.projects.find((p) => p.id === state.activeProjectId)
}

/** Painel em foco na aba ativa (o único painel, ou o focado no grid). */
export function focusedPane(state: WorkspaceState): Pane | undefined {
  const tab = activeTab(state)
  if (!tab) return undefined
  const paneId = tab.focusedPaneId ?? tab.paneIds[0]
  return paneId ? state.panes[paneId] : undefined
}

function makePane(state: WorkspaceState, kind: PaneKind, project: Project, id = newId()): Pane {
  const base = { id, projectId: project.id, cwd: project.path }
  return kind === "terminal"
    ? { ...base, kind, title: state.shell }
    : { ...base, kind, title: "Agente", messages: [], thinking: false }
}

function withActiveTab(state: WorkspaceState, projectId: string, tabId: string | null): WorkspaceState {
  return { ...state, activeTabByProject: { ...state.activeTabByProject, [projectId]: tabId } }
}

function removeTab(state: WorkspaceState, tabId: string): WorkspaceState {
  const index = state.tabs.findIndex((t) => t.id === tabId)
  if (index < 0) return state
  const tab = state.tabs[index]
  const panes = { ...state.panes }
  for (const paneId of tab.paneIds) delete panes[paneId]
  const tabs = state.tabs.filter((t) => t.id !== tabId)

  let next: WorkspaceState = { ...state, tabs, panes }
  if (state.activeTabByProject[tab.projectId] === tabId) {
    const siblings = tabs.filter((t) => t.projectId === tab.projectId)
    const projectIndex = state.tabs.filter((t) => t.projectId === tab.projectId).indexOf(tab)
    const fallback = siblings[Math.min(projectIndex, siblings.length - 1)]
    next = withActiveTab(next, tab.projectId, fallback?.id ?? null)
  }
  return next
}

function updateTab(state: WorkspaceState, tabId: string, patch: (tab: Tab) => Tab): WorkspaceState {
  return { ...state, tabs: state.tabs.map((t) => (t.id === tabId ? patch(t) : t)) }
}

function updatePane<K extends Pane["kind"]>(
  state: WorkspaceState,
  paneId: string,
  patch: (pane: Extract<Pane, { kind: K }>) => Pane,
  kind?: K,
): WorkspaceState {
  const pane = state.panes[paneId]
  if (!pane || (kind && pane.kind !== kind)) return state
  return { ...state, panes: { ...state.panes, [paneId]: patch(pane as Extract<Pane, { kind: K }>) } }
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "project/add": {
      const project: Project = {
        id: newId(),
        name: action.name,
        path: action.path,
        color: projectColor(state.projects.length),
      }
      return {
        ...state,
        projects: [...state.projects, project],
        activeProjectId: project.id,
        activeTabByProject: { ...state.activeTabByProject, [project.id]: null },
      }
    }

    case "project/remove": {
      if (state.projects.length <= 1) return state
      let next = state
      for (const tab of state.tabs.filter((t) => t.projectId === action.projectId)) {
        next = removeTab(next, tab.id)
      }
      const projects = next.projects.filter((p) => p.id !== action.projectId)
      const activeTabByProject = { ...next.activeTabByProject }
      delete activeTabByProject[action.projectId]
      return {
        ...next,
        projects,
        activeTabByProject,
        activeProjectId:
          next.activeProjectId === action.projectId ? projects[0].id : next.activeProjectId,
      }
    }

    case "project/select": {
      // A aba ativa do projeto fica à vista: o aviso dela já foi visto.
      const tabId = state.activeTabByProject[action.projectId]
      const seen = tabId ? updateTab(state, tabId, (t) => ({ ...t, attention: false })) : state
      return { ...seen, activeProjectId: action.projectId }
    }

    case "tab/new": {
      const project = activeProject(state)
      if (!project) return state
      const pane = makePane(state, action.kind, project, action.paneId)
      const tab: Tab = {
        id: newId(),
        projectId: project.id,
        kind: action.kind,
        title: pane.title,
        paneIds: [pane.id],
        focusedPaneId: pane.id,
      }
      return withActiveTab(
        { ...state, tabs: [...state.tabs, tab], panes: { ...state.panes, [pane.id]: pane } },
        project.id,
        tab.id,
      )
    }

    case "tab/newGrid": {
      const project = activeProject(state)
      if (!project) return state
      const pane = makePane(state, "terminal", project)
      const tab: Tab = {
        id: newId(),
        projectId: project.id,
        kind: "grid",
        title: "Grid",
        paneIds: [pane.id],
        focusedPaneId: pane.id,
      }
      return withActiveTab(
        { ...state, tabs: [...state.tabs, tab], panes: { ...state.panes, [pane.id]: pane } },
        project.id,
        tab.id,
      )
    }

    case "tab/groupIntoGrid": {
      const projectId = state.activeProjectId
      const single = state.tabs.filter((t) => t.projectId === projectId && t.kind !== "grid")
      if (single.length < 2) return state
      const grouped = single.slice(0, GRID_LIMIT)
      const groupedIds = new Set(grouped.map((t) => t.id))
      const paneIds = grouped.flatMap((t) => t.paneIds)
      const tab: Tab = {
        id: newId(),
        projectId,
        kind: "grid",
        title: "Grid",
        paneIds,
        focusedPaneId: paneIds[0],
      }
      // Os painéis continuam no estado: só mudam de aba, e o terminal segue vivo.
      return withActiveTab(
        { ...state, tabs: [...state.tabs.filter((t) => !groupedIds.has(t.id)), tab] },
        projectId,
        tab.id,
      )
    }

    case "tab/select": {
      const tab = state.tabs.find((t) => t.id === action.tabId)
      if (!tab) return state
      const seen = updateTab(state, tab.id, (t) => ({ ...t, attention: false }))
      return withActiveTab({ ...seen, activeProjectId: tab.projectId }, tab.projectId, tab.id)
    }

    case "tab/attention": {
      const tab = state.tabs.find((t) => t.paneIds.includes(action.paneId))
      if (!tab || tab.attention) return state
      return updateTab(state, tab.id, (t) => ({ ...t, attention: true }))
    }

    case "tab/close":
      return removeTab(state, action.tabId)

    case "tab/rename": {
      const title = action.title.trim()
      const tab = state.tabs.find((t) => t.id === action.tabId)
      if (!tab || !title) return state
      const renamed = updateTab(state, tab.id, (t) => ({ ...t, title }))
      // Aba de um painel só: o painel leva o nome junto, e ele continua igual se for para um grid.
      return tab.kind === "grid" ? renamed : updatePane(renamed, tab.paneIds[0], (p) => ({ ...p, title }))
    }

    case "pane/addToGrid": {
      const tab = state.tabs.find((t) => t.id === action.tabId)
      const project = state.projects.find((p) => p.id === tab?.projectId)
      if (!tab || !project || tab.kind !== "grid" || tab.paneIds.length >= GRID_LIMIT) return state
      const pane = makePane(state, action.kind, project)
      return updateTab(
        { ...state, panes: { ...state.panes, [pane.id]: pane } },
        tab.id,
        (t) => ({ ...t, paneIds: [...t.paneIds, pane.id], focusedPaneId: pane.id }),
      )
    }

    case "pane/focus":
      return updateTab(state, action.tabId, (t) => ({ ...t, focusedPaneId: action.paneId }))

    case "pane/close": {
      const tab = state.tabs.find((t) => t.id === action.tabId)
      if (!tab) return state
      if (tab.kind !== "grid") return removeTab(state, tab.id)
      const panes = { ...state.panes }
      delete panes[action.paneId]
      return updateTab({ ...state, panes }, tab.id, (t) => {
        const paneIds = t.paneIds.filter((id) => id !== action.paneId)
        const focusedPaneId = t.focusedPaneId === action.paneId ? (paneIds[0] ?? null) : t.focusedPaneId
        return { ...t, paneIds, focusedPaneId }
      })
    }

    case "pane/rename": {
      const title = action.title.trim()
      if (!title) return state
      return updatePane(state, action.paneId, (p) => ({ ...p, title }))
    }

    case "pane/setCwd":
      return updatePane(state, action.paneId, (p) => ({ ...p, cwd: action.cwd }))

    case "agent/append":
      return updatePane(
        state,
        action.paneId,
        (p) => ({ ...p, messages: [...p.messages, action.message] }),
        "agent",
      )

    case "agent/thinking":
      return updatePane(state, action.paneId, (p) => ({ ...p, thinking: action.thinking }), "agent")

    case "agent/update":
      return updatePane(state, action.paneId, (p) => ({ ...p, ...action.patch }), "agent")

    case "settings/update":
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case "workflow/save": {
      const exists = state.workflows.some((w) => w.id === action.workflow.id)
      return {
        ...state,
        workflows: exists
          ? state.workflows.map((w) => (w.id === action.workflow.id ? action.workflow : w))
          : [...state.workflows, action.workflow],
      }
    }

    case "workflow/remove":
      return { ...state, workflows: state.workflows.filter((w) => w.id !== action.workflowId) }

    case "shell/set":
      return { ...state, shell: action.shell }
  }
}
