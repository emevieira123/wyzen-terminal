import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react"

import { DEFAULT_MODEL_ID, getModel } from "@/lib/agents"
import { defaultShell, quotePath } from "@/lib/pty"
import { terminalRegistry } from "@/lib/terminal-registry"
import type { Project, Settings, Workflow, WorkspaceState } from "@/state/types"
import {
  focusedPane,
  newId,
  projectColor,
  workspaceReducer,
  type WorkspaceAction,
} from "@/state/workspace-reducer"

const STORAGE_KEY = "wyzen-terminal:v1"

interface Persisted {
  projects: Project[]
  workflows: Workflow[]
  settings: Settings
}

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  modelId: DEFAULT_MODEL_ID,
  showWorkflows: true,
  discoveredModels: {},
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as Partial<Persisted>
      if (data.projects?.length) {
        return {
          projects: data.projects,
          workflows: data.workflows ?? [],
          settings: {
            ...DEFAULT_SETTINGS,
            ...data.settings,
            // Modelos que saíram da lista caem no padrão.
            modelId: getModel(data.settings?.modelId).id,
          },
        }
      }
    }
  } catch {
    // Storage corrompido ou indisponível: recomeça com o padrão.
  }
  return {
    projects: [{ id: newId(), name: "Home", path: "~", color: projectColor(0) }],
    workflows: [],
    settings: DEFAULT_SETTINGS,
  }
}

function initState(): WorkspaceState {
  const { projects, workflows, settings } = loadPersisted()
  return {
    projects,
    workflows,
    settings,
    panes: {},
    tabs: [],
    activeProjectId: projects[0].id,
    activeTabByProject: Object.fromEntries(projects.map((p) => [p.id, null])),
    shell: "shell",
  }
}

interface WorkspaceContextValue {
  state: WorkspaceState
  dispatch: (action: WorkspaceAction) => void
  /** Roda `cmd` no terminal em foco; sem terminal em foco, abre um novo. */
  runCommand: (cmd: string) => void
  /** Faz `cd` no terminal em foco (ou abre um novo já no diretório). */
  changeDirectory: (path: string) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, initState)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    void defaultShell()
      .then((shell) => dispatch({ type: "shell/set", shell }))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const data: Persisted = {
      projects: state.projects,
      workflows: state.workflows,
      settings: state.settings,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [state.projects, state.workflows, state.settings])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.settings.theme === "dark")
    terminalRegistry.setTheme(state.settings.theme)
  }, [state.settings.theme])

  // Painel de terminal que sumiu do estado = PTY a encerrar.
  const previousPanes = useRef(state.panes)
  useEffect(() => {
    for (const [id, pane] of Object.entries(previousPanes.current)) {
      if (pane.kind === "terminal" && !state.panes[id]) terminalRegistry.dispose(id)
    }
    previousPanes.current = state.panes
  }, [state.panes])

  const runCommand = useCallback((cmd: string) => {
    const pane = focusedPane(stateRef.current)
    if (pane?.kind === "terminal") {
      terminalRegistry.send(pane.id, `${cmd}\r`)
      terminalRegistry.focus(pane.id)
      return
    }
    const paneId = newId()
    terminalRegistry.send(paneId, `${cmd}\r`)
    dispatch({ type: "tab/new", kind: "terminal", paneId })
  }, [])

  const changeDirectory = useCallback(
    (path: string) => {
      const pane = focusedPane(stateRef.current)
      if (pane?.kind === "terminal") {
        terminalRegistry.send(pane.id, `cd ${quotePath(path)}\r`)
        dispatch({ type: "pane/setCwd", paneId: pane.id, cwd: path })
        terminalRegistry.focus(pane.id)
        return
      }
      runCommand(`cd ${quotePath(path)}`)
    },
    [runCommand],
  )

  const value = useMemo(
    () => ({ state, dispatch, runCommand, changeDirectory }),
    [state, runCommand, changeDirectory],
  )

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = use(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace precisa estar dentro de <WorkspaceProvider>")
  return ctx
}
