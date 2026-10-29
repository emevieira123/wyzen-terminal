import { useEffect, useRef, useState, type FormEvent } from "react"
import { CornerDownLeft, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useGitBranch } from "@/hooks/use-git-branch"
import { getModel, sendToAgent, type AgentMessage } from "@/lib/agents"
import { cn } from "@/lib/utils"
import type { AgentPane } from "@/state/types"
import { useWorkspace } from "@/state/workspace-context"

interface AgentViewProps {
  pane: AgentPane
  /** Versão compacta usada dentro do grid. */
  compact?: boolean
}

export function AgentView({ pane, compact = false }: AgentViewProps) {
  const { state, dispatch, runCommand } = useWorkspace()
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const project = state.projects.find((p) => p.id === pane.projectId)
  const branch = useGitBranch(pane.cwd)
  const model = getModel(state.settings.modelId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [pane.messages.length, pane.thinking])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Adiado: um menu/diálogo que ainda está fechando tiraria o foco do input.
  useEffect(() => {
    if (compact) return
    const timer = setTimeout(() => inputRef.current?.focus())
    return () => clearTimeout(timer)
  }, [compact])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const text = input.trim()
    if (!text || pane.thinking) return

    const userMessage: AgentMessage = { role: "user", text }
    setInput("")
    dispatch({ type: "agent/append", paneId: pane.id, message: userMessage })
    dispatch({ type: "agent/thinking", paneId: pane.id, thinking: true })

    abortRef.current = new AbortController()
    try {
      const reply = await sendToAgent(
        state.settings.modelId,
        [...pane.messages, userMessage],
        { projectName: project?.name ?? "", cwd: pane.cwd, branch },
        abortRef.current.signal,
      )
      dispatch({
        type: "agent/append",
        paneId: pane.id,
        message: { role: "assistant", text: reply.text, command: reply.command },
      })
    } catch (error) {
      if (!abortRef.current.signal.aborted) {
        dispatch({
          type: "agent/append",
          paneId: pane.id,
          message: { role: "assistant", text: `Erro do provedor: ${String(error)}` },
        })
      }
    } finally {
      dispatch({ type: "agent/thinking", paneId: pane.id, thinking: false })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!compact && (
        <div className="flex items-center gap-2.5 border-b px-6 py-2.5 text-[12.5px] text-muted-foreground">
          <Sparkles className="size-3.5 text-ai" />
          <span className="font-medium text-foreground">{model.name}</span>
          <span>
            · contexto: {project?.name}
            {branch && ` · ${branch}`}
          </span>
          <span className="ml-auto truncate font-mono text-[11px]">{pane.cwd}</span>
        </div>
      )}

      <div
        ref={scrollRef}
        className={cn("flex min-h-0 flex-1 flex-col overflow-auto", compact ? "gap-2 p-3" : "gap-4 p-6")}
      >
        {pane.messages.length === 0 && !pane.thinking && (
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
            Pergunte sobre {project?.name ?? "o projeto"}, peça um comando ou cole um erro.
          </p>
        )}
        {pane.messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            modelName={model.name}
            compact={compact}
            onRun={runCommand}
          />
        ))}
        {pane.thinking && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Sparkles className="size-3.5 animate-pulse text-ai" />
            Pensando…
          </div>
        )}
      </div>

      <form onSubmit={submit} className={cn(compact ? "border-t px-2.5 py-2" : "px-6 pt-3.5 pb-4.5")}>
        <div
          className={cn(
            "flex items-center gap-2.5",
            !compact && "rounded-[10px] border border-input bg-panel px-3.5 py-2.5",
          )}
        >
          <Sparkles className="size-3.5 shrink-0 text-ai" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={compact ? "Perguntar…" : "Pergunte sobre o projeto, peça um comando ou cole um erro…"}
            className={cn(
              "min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-dim",
              compact ? "text-[12.5px]" : "text-[13.5px]",
            )}
          />
          {!compact && (
            <Button type="submit" variant="outline" size="icon-xs" aria-label="Enviar">
              <CornerDownLeft />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

function MessageBubble({
  message,
  modelName,
  compact,
  onRun,
}: {
  message: AgentMessage
  modelName: string
  compact: boolean
  onRun: (cmd: string) => void
}) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex max-w-[760px] flex-col gap-1.5", isUser && "items-end self-end")}>
      <div className="flex items-center gap-1.5 text-[11px] text-dim">
        {isUser ? "Você" : (
          <>
            <Sparkles className="size-3 text-ai" />
            {modelName}
          </>
        )}
      </div>
      <div
        className={cn(
          "whitespace-pre-wrap leading-relaxed",
          compact ? "text-xs" : "text-[13.5px]",
          isUser ? "rounded-[10px] border bg-panel px-3 py-2 text-foreground" : "text-term",
        )}
      >
        {message.text}
      </div>
      {message.command && (
        <div className="flex items-center gap-2.5 rounded-md border bg-chrome px-3 py-2 font-mono text-[13px] text-foreground">
          <span className="min-w-0 flex-1 truncate">{message.command}</span>
          <Button size="xs" onClick={() => onRun(message.command!)}>
            {compact ? "Executar" : "Executar no terminal"}
          </Button>
        </div>
      )}
    </div>
  )
}
