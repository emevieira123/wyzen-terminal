import { useEffect, useRef, useState, type FormEvent } from "react"
import { CornerDownLeft, Sparkles, Square } from "lucide-react"

import { ModelSelect } from "@/components/ModelSelect"
import { Button } from "@/components/ui/button"
import { useGitBranch } from "@/hooks/use-git-branch"
import { AgentError, getModel, getProvider, modelName, withoutCommandBlock, type AgentMessage } from "@/lib/agents"
import { isMac, isWindows } from "@/lib/platform"
import { cn } from "@/lib/utils"
import type { AgentPane, Project } from "@/state/types"
import { useWorkspace } from "@/state/workspace-context"

interface AgentViewProps {
  pane: AgentPane
  /** Versão compacta usada dentro do grid. */
  compact?: boolean
}

function buildSystemPrompt(project: Project | undefined, shell: string): string {
  const os = isMac ? "macOS" : isWindows ? "Windows" : "Linux"
  return [
    "Você é o assistente do Wyzen Terminal, um terminal para desenvolvedores.",
    "Responda em português do Brasil, de forma direta.",
    `O usuário trabalha no projeto "${project?.name ?? "sem nome"}" (${project?.path ?? "~"}), em ${os}, com o shell ${shell}.`,
    "Cada mensagem do usuário pode trazer o diretório e a branch atuais.",
    "Quando propuser um comando para o usuário rodar, coloque-o num bloco ```sh no fim da resposta; o terminal mostra um botão para executá-lo.",
    "Você não tem acesso ao terminal nem à saída dos comandos: nunca diga que executou algo.",
  ].join("\n")
}

export function AgentView({ pane, compact = false }: AgentViewProps) {
  const { state, dispatch, runCommand } = useWorkspace()
  const [input, setInput] = useState("")
  /** Resposta chegando em streaming; `null` fora de uma requisição. */
  const [streaming, setStreaming] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const project = state.projects.find((p) => p.id === pane.projectId)
  const branch = useGitBranch(pane.cwd)
  const model = getModel(pane.modelId ?? state.settings.modelId)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [pane.messages.length, streaming])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Adiado: um menu/diálogo que ainda está fechando tiraria o foco do input.
  useEffect(() => {
    if (compact) return
    const timer = setTimeout(() => inputRef.current?.focus())
    return () => clearTimeout(timer)
  }, [compact])

  const append = (message: AgentMessage) => dispatch({ type: "agent/append", paneId: pane.id, message })
  const note = (text: string, tone: "error" | "info" = "info") => append({ role: "note", text, tone })

  async function submit(event: FormEvent) {
    event.preventDefault()
    const text = input.trim()
    if (!text || pane.thinking) return

    const system = pane.systemPrompt ?? buildSystemPrompt(project, state.shell)
    const context = `Diretório atual: ${pane.cwd}${branch ? ` · branch git: ${branch}` : ""}`
    const contextChanged = context !== pane.lastContext
    const userMessage: AgentMessage = { role: "user", text, context: contextChanged ? context : undefined }

    setInput("")
    append(userMessage)
    dispatch({ type: "agent/update", paneId: pane.id, patch: { systemPrompt: system, lastContext: context } })
    dispatch({ type: "agent/thinking", paneId: pane.id, thinking: true })
    setStreaming("")

    const controller = new AbortController()
    abortRef.current = controller
    let partial = ""
    try {
      const reply = await getProvider(model.provider).send({
        model,
        system,
        history: [...pane.messages, userMessage],
        signal: controller.signal,
        onText: (delta) => {
          partial += delta
          setStreaming(partial)
        },
        onReset: () => {
          partial = ""
          setStreaming("")
        },
      })

      if (reply.kind === "refusal") {
        note(`${model.name} recusou responder${reply.category ? ` (categoria: ${reply.category})` : ""}.`, "error")
        return
      }
      append({ role: "assistant", text: reply.text, command: reply.command, raw: reply.raw, modelId: reply.servedBy })
      if (reply.servedBy !== model.id) note(`Respondido por ${modelName(reply.servedBy)}, porque ${model.name} recusou.`)
      if (reply.truncated) note("A resposta atingiu o limite de tamanho e foi cortada.")
    } catch (error) {
      if (controller.signal.aborted) {
        if (partial) append({ role: "assistant", text: partial, modelId: model.id })
        note("Resposta interrompida.")
      } else {
        note(error instanceof AgentError ? error.message : `Erro inesperado: ${String(error)}`, "error")
      }
    } finally {
      abortRef.current = null
      setStreaming(null)
      dispatch({ type: "agent/thinking", paneId: pane.id, thinking: false })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!compact && (
        <div className="flex items-center gap-2.5 border-b px-6 py-1.5 text-[12.5px] text-muted-foreground">
          <ModelSelect
            value={model.id}
            onChange={(modelId) => dispatch({ type: "agent/update", paneId: pane.id, patch: { modelId } })}
            className="w-auto font-medium text-foreground"
          />
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
        {pane.messages.length === 0 && streaming === null && (
          <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
            Pergunte sobre {project?.name ?? "o projeto"}, peça um comando ou cole um erro.
          </p>
        )}
        {pane.messages.map((message, index) => (
          <MessageBubble key={index} message={message} compact={compact} onRun={runCommand} />
        ))}
        {streaming !== null &&
          (streaming ? (
            <MessageBubble
              message={{ role: "assistant", text: streaming, modelId: model.id }}
              compact={compact}
              onRun={runCommand}
            />
          ) : (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Sparkles className="size-3.5 animate-pulse text-ai" />
              Pensando…
            </div>
          ))}
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
          {pane.thinking ? (
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              aria-label="Interromper resposta"
              onClick={() => abortRef.current?.abort()}
            >
              <Square className="fill-current" />
            </Button>
          ) : (
            !compact && (
              <Button type="submit" variant="outline" size="icon-xs" aria-label="Enviar">
                <CornerDownLeft />
              </Button>
            )
          )}
        </div>
      </form>
    </div>
  )
}

function MessageBubble({
  message,
  compact,
  onRun,
}: {
  message: AgentMessage
  compact: boolean
  onRun: (cmd: string) => void
}) {
  if (message.role === "note") {
    return (
      <p className={cn("text-xs", message.tone === "error" ? "text-destructive" : "text-dim")}>{message.text}</p>
    )
  }

  const isUser = message.role === "user"
  const command = message.role === "assistant" ? message.command : undefined
  const text = command ? withoutCommandBlock(message.text) : message.text
  return (
    <div className={cn("flex max-w-[760px] flex-col gap-1.5", isUser && "items-end self-end")}>
      <div className="flex items-center gap-1.5 text-[11px] text-dim">
        {isUser ? (
          "Você"
        ) : (
          <>
            <Sparkles className="size-3 text-ai" />
            {modelName(message.modelId)}
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
        {text}
      </div>
      {command && (
        <div className="flex items-center gap-2.5 rounded-md border bg-chrome px-3 py-2 font-mono text-[13px] text-foreground">
          <span className="min-w-0 flex-1 truncate">{command}</span>
          <Button size="xs" onClick={() => onRun(command)}>
            {compact ? "Executar" : "Executar no terminal"}
          </Button>
        </div>
      )}
    </div>
  )
}
