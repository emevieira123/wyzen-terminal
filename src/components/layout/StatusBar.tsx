import { FolderOpen, GitBranch, Sparkles } from "lucide-react"

import { useGitBranch } from "@/hooks/use-git-branch"
import { getModel } from "@/lib/agents"
import { activeProject, focusedPane } from "@/state/workspace-reducer"
import { useWorkspace } from "@/state/workspace-context"

export function StatusBar({ onChangeDirectory }: { onChangeDirectory: () => void }) {
  const { state } = useWorkspace()
  const cwd = focusedPane(state)?.cwd ?? activeProject(state)?.path
  const branch = useGitBranch(cwd)
  const model = getModel(state.settings.modelId)

  return (
    <footer className="relative z-20 flex h-7 shrink-0 items-center gap-4.5 border-t bg-chrome px-3.5 text-[11.5px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-success" />
        {state.shell}
      </span>
      <button
        type="button"
        onClick={onChangeDirectory}
        title="Alterar diretório"
        className="flex items-center gap-1.5 font-mono text-[11px] hover:text-foreground"
      >
        <FolderOpen className="size-3" />
        {cwd}
      </button>
      {branch && (
        <span className="flex items-center gap-1">
          <GitBranch className="size-3 text-branch" />
          {branch}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        <Sparkles className="size-3 text-ai" />
        {model.name}
      </span>
      <span>UTF-8</span>
      <span>{state.settings.theme === "dark" ? "Escuro" : "Claro"}</span>
    </footer>
  )
}
