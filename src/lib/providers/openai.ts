import OpenAI from "openai"

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

let cached: { key: string; client: OpenAI } | null = null

async function getClient(): Promise<OpenAI> {
  const key = await secrets.get("openai")
  if (!key) throw missingKeyError("openai")
  if (cached?.key !== key) {
    // A chave é do próprio usuário e sai do cofre do sistema só para a chamada.
    cached = { key, client: new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true }) }
  }
  return cached.client
}

function toInput(history: AgentMessage[]): OpenAI.Responses.EasyInputMessage[] {
  const input: OpenAI.Responses.EasyInputMessage[] = []
  for (const message of history) {
    if (message.role === "user") {
      const text = message.context ? `${message.context}\n\n${message.text}` : message.text
      input.push({ role: "user", content: text })
    } else if (message.role === "assistant") {
      input.push({ role: "assistant", content: message.text })
    }
  }
  return input
}

/** Modelos de chat; a listagem da OpenAI mistura áudio, imagem, embeddings etc. */
const CHAT_MODEL = /^(gpt-|o\d|chatgpt-)/
const NOT_CHAT = /(audio|realtime|tts|transcribe|image|search|embedding|instruct|moderation|live|dall-e|codex)/

function describeError(error: unknown): never {
  if (error instanceof OpenAI.AuthenticationError) {
    throw new AgentError("A OpenAI recusou a chave de API. Confira em Configurações > Provedor de IA > GPT.")
  }
  if (error instanceof OpenAI.PermissionDeniedError) {
    throw new AgentError("Esta chave não tem acesso a este modelo.")
  }
  if (error instanceof OpenAI.NotFoundError) {
    throw new AgentError("Modelo não encontrado para esta conta. Atualize a lista em Configurações.")
  }
  if (error instanceof OpenAI.RateLimitError) {
    throw new AgentError("Limite de uso ou de créditos atingido na OpenAI.")
  }
  if (error instanceof OpenAI.APIConnectionError) {
    throw new AgentError("Sem conexão com a API da OpenAI.")
  }
  if (error instanceof OpenAI.APIError) {
    throw new AgentError(`Erro da API (${error.status ?? "?"}): ${error.message}`)
  }
  throw error
}

export const openaiProvider: AgentProvider = {
  id: "openai",

  async send({ model, system, history, signal, onText }: AgentRequest): Promise<AgentReply> {
    const client = await getClient()
    try {
      const stream = client.responses.stream(
        {
          model: model.id,
          instructions: system,
          input: toInput(history),
          // Sem guardar a conversa nos servidores da OpenAI; o histórico vai em cada chamada.
          store: false,
        },
        { signal },
      )

      let refusal = ""
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") onText(event.delta)
        if (event.type === "response.refusal.delta") refusal += event.delta
      }

      const response = await stream.finalResponse()
      if (refusal) return { kind: "refusal", category: null }
      if (response.status === "failed") {
        throw new AgentError(`A OpenAI não concluiu a resposta: ${response.error?.message ?? "erro desconhecido"}`)
      }
      const text = response.output_text
      return {
        kind: "answer",
        text,
        command: extractCommand(text),
        raw: undefined,
        servedBy: model.id,
        truncated: response.status === "incomplete",
      }
    } catch (error) {
      if (signal.aborted || error instanceof AgentError) throw error
      describeError(error)
    }
  },

  async test() {
    const client = await getClient()
    try {
      await client.models.list()
    } catch (error) {
      describeError(error)
    }
  },

  async listModels() {
    const client = await getClient()
    try {
      const ids: string[] = []
      for await (const m of client.models.list()) {
        if (CHAT_MODEL.test(m.id) && !NOT_CHAT.test(m.id)) ids.push(m.id)
      }
      return ids.sort().reverse()
    } catch (error) {
      describeError(error)
    }
  },
}
