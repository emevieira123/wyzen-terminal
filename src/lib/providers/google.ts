import { ApiError, FinishReason, GoogleGenAI, type Content } from "@google/genai"

import {
  AgentError,
  extractCommand,
  missingKeyError,
  type AgentMessage,
  type AgentProvider,
  type AgentReply,
  type AgentRequest,
} from "@/lib/agents"
import { secrets } from "@/lib/secrets"

let cached: { key: string; client: GoogleGenAI } | null = null

async function getClient(): Promise<GoogleGenAI> {
  const key = await secrets.get("google")
  if (!key) throw missingKeyError("google")
  if (cached?.key !== key) cached = { key, client: new GoogleGenAI({ apiKey: key }) }
  return cached.client
}

function toContents(history: AgentMessage[]): Content[] {
  const contents: Content[] = []
  for (const message of history) {
    if (message.role === "user") {
      const text = message.context ? `${message.context}\n\n${message.text}` : message.text
      contents.push({ role: "user", parts: [{ text }] })
    } else if (message.role === "assistant") {
      contents.push({ role: "model", parts: [{ text: message.text }] })
    }
  }
  return contents
}

/** Motivos de parada que significam bloqueio pelos filtros de segurança. */
const BLOCKED = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
])

function describeError(error: unknown): never {
  if (error instanceof ApiError) {
    // A API do Gemini responde 400 (API_KEY_INVALID) para chave inválida.
    if (error.status === 400 && /api.?key/i.test(error.message)) {
      throw new AgentError("O Google recusou a chave de API. Confira em Configurações > Provedor de IA > Gemini.")
    }
    if (error.status === 401 || error.status === 403) {
      throw new AgentError("Esta chave não tem acesso à API do Gemini ou a este modelo.")
    }
    if (error.status === 404) {
      throw new AgentError("Modelo não encontrado para esta conta. Atualize a lista em Configurações.")
    }
    if (error.status === 429) {
      throw new AgentError("Limite de uso atingido no Gemini. Tente de novo em instantes.")
    }
    throw new AgentError(`Erro da API do Gemini (${error.status}): ${error.message}`)
  }
  if (error instanceof TypeError) {
    throw new AgentError("Sem conexão com a API do Gemini.")
  }
  throw error
}

export const googleProvider: AgentProvider = {
  id: "google",

  async send({ model, system, history, signal, onText }: AgentRequest): Promise<AgentReply> {
    const client = await getClient()
    try {
      const stream = await client.models.generateContentStream({
        model: model.id,
        contents: toContents(history),
        config: { systemInstruction: system, abortSignal: signal },
      })

      let text = ""
      let finishReason: FinishReason | undefined
      let blockReason: string | undefined
      for await (const chunk of stream) {
        const delta = chunk.text
        if (delta) {
          text += delta
          onText(delta)
        }
        finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason
        blockReason = chunk.promptFeedback?.blockReason ?? blockReason
      }
      if (signal.aborted) throw new DOMException("Aborted", "AbortError")

      if (blockReason) return { kind: "refusal", category: blockReason.toLowerCase() }
      if (finishReason && BLOCKED.has(finishReason)) return { kind: "refusal", category: finishReason.toLowerCase() }
      return {
        kind: "answer",
        text,
        command: extractCommand(text),
        raw: undefined,
        servedBy: model.id,
        truncated: finishReason === FinishReason.MAX_TOKENS,
      }
    } catch (error) {
      if (signal.aborted) throw error
      describeError(error)
    }
  },

  async test() {
    const client = await getClient()
    try {
      await client.models.list({ config: { pageSize: 1 } })
    } catch (error) {
      describeError(error)
    }
  },

  async listModels() {
    const client = await getClient()
    try {
      const ids: string[] = []
      for await (const m of await client.models.list()) {
        const id = m.name?.replace(/^models\//, "")
        if (id?.startsWith("gemini") && m.supportedActions?.includes("generateContent")) ids.push(id)
      }
      return ids.sort().reverse()
    } catch (error) {
      describeError(error)
    }
  },
}
