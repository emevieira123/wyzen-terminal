import Anthropic from "@anthropic-ai/sdk"

import {
  AgentError,
  extractCommand,
  isFromProvider,
  missingKeyError,
  type AgentMessage,
  type AgentProvider,
  type AgentReply,
  type AgentRequest,
} from "@/lib/agents"
import { secrets } from "@/lib/secrets"

type Block = Anthropic.Beta.BetaContentBlock

const MAX_TOKENS = 64_000
const FALLBACK_BETA = "server-side-fallback-2026-07-01"

let cached: { key: string; client: Anthropic } | null = null

async function getClient(): Promise<Anthropic> {
  const key = await secrets.get("anthropic")
  if (!key) throw missingKeyError("anthropic")
  if (cached?.key !== key) {
    // App desktop: a chave é do próprio usuário e sai do cofre do sistema só
    // para esta chamada. O SDK exige a opção explícita fora do Node.
    cached = { key, client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }) }
  }
  return cached.client
}

/**
 * Depois de uma troca de modelo no meio da resposta, os blocos internos
 * (thinking, tool_use) anteriores ao último `fallback` não podem ser reenviados.
 * Todo o resto volta exatamente como veio.
 */
function echoable(content: Block[]): Block[] {
  const boundary = content.findLastIndex((b) => b.type === "fallback")
  if (boundary < 0) return content
  const internal = new Set(["thinking", "redacted_thinking", "tool_use"])
  return content.filter((b, i) => i >= boundary || !internal.has(b.type))
}

function toParams(history: AgentMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const params: Anthropic.Beta.BetaMessageParam[] = []
  for (const message of history) {
    if (message.role === "user") {
      const content: Anthropic.Beta.BetaTextBlockParam[] = []
      if (message.context) content.push({ type: "text", text: message.context })
      content.push({ type: "text", text: message.text })
      params.push({ role: "user", content })
    } else if (message.role === "assistant") {
      // Histórico só cresce: a resposta volta com os mesmos blocos que chegaram,
      // inclusive os de thinking. Respostas de outro provedor vão só como texto.
      const raw = isFromProvider(message, "anthropic") ? (message.raw as Block[] | undefined) : undefined
      params.push({ role: "assistant", content: raw ? echoable(raw) : message.text })
    }
  }
  return params
}

function finalText(content: Block[]): string {
  const boundary = content.findLastIndex((b) => b.type === "fallback")
  return content
    .slice(boundary + 1)
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
}

function describeError(error: unknown): never {
  if (error instanceof Anthropic.AuthenticationError) {
    throw new AgentError("A Anthropic recusou a chave de API. Confira em Configurações > Provedor de IA > Claude.")
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    throw new AgentError("Esta chave não tem acesso a este modelo.")
  }
  if (error instanceof Anthropic.NotFoundError) {
    throw new AgentError("Modelo não encontrado para esta conta.")
  }
  if (error instanceof Anthropic.RateLimitError) {
    throw new AgentError("Limite de uso atingido. Tente de novo em instantes.")
  }
  if (error instanceof Anthropic.APIConnectionError) {
    throw new AgentError("Sem conexão com a API da Anthropic.")
  }
  if (error instanceof Anthropic.APIError) {
    throw new AgentError(`Erro da API (${error.status ?? "?"}): ${error.message}`)
  }
  throw error
}

export const anthropicProvider: AgentProvider = {
  id: "anthropic",

  async send({ model, system, history, signal, onText, onReset }: AgentRequest): Promise<AgentReply> {
    const client = await getClient()
    const fallback = model.serverFallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}

    try {
      const stream = client.beta.messages.stream(
        {
          model: model.id,
          max_tokens: MAX_TOKENS,
          system,
          messages: toParams(history),
          // O prefixo (system + histórico) se repete a cada turno; o cache barateia.
          cache_control: { type: "ephemeral" },
          ...fallback,
        },
        { signal },
      )

      for await (const event of stream) {
        if (event.type === "content_block_start" && event.content_block.type === "fallback") onReset()
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") onText(event.delta.text)
      }

      const message = await stream.finalMessage()
      if (message.stop_reason === "refusal") {
        return { kind: "refusal", category: message.stop_details?.category ?? null }
      }
      const text = finalText(message.content)
      return {
        kind: "answer",
        text,
        command: extractCommand(text),
        raw: message.content,
        servedBy: message.model,
        truncated: message.stop_reason === "max_tokens",
      }
    } catch (error) {
      // Interrupção pelo usuário segue como está; quem chamou trata.
      if (signal.aborted) throw error
      describeError(error)
    }
  },

  async test() {
    const client = await getClient()
    try {
      await client.models.list({ limit: 1 })
    } catch (error) {
      describeError(error)
    }
  },

  async listModels() {
    const client = await getClient()
    try {
      const ids: string[] = []
      for await (const m of client.models.list()) ids.push(m.id)
      return ids
    } catch (error) {
      describeError(error)
    }
  },
}
