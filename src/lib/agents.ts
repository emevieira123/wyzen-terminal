/**
 * Camada de agentes de IA: provedores (Claude, GPT, Gemini), modelos, mensagens
 * do chat e o registro de implementações. Cada provedor implementa
 * `AgentProvider` em `src/lib/providers/` e é registrado no `main.tsx`.
 */

export type ProviderId = "anthropic" | "openai" | "google"

export interface ProviderInfo {
  id: ProviderId
  /** Nome curto da família de modelos, usado nas abas. */
  name: string
  vendor: string
  keyUrl: string
  keyPlaceholder: string
  envVar: string
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "anthropic",
    name: "Claude",
    vendor: "Anthropic",
    keyUrl: "https://platform.claude.com/settings/keys",
    keyPlaceholder: "sk-ant-…",
    envVar: "ANTHROPIC_API_KEY",
  },
  {
    id: "openai",
    name: "GPT",
    vendor: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-…",
    envVar: "OPENAI_API_KEY",
  },
  {
    id: "google",
    name: "Gemini",
    vendor: "Google",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza…",
    envVar: "GEMINI_API_KEY",
  },
]

export function getProviderInfo(id: ProviderId): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]
}

export interface ModelInfo {
  id: string
  name: string
  provider: ProviderId
  description: string
  /** Re-executa recusas dos classificadores em outro modelo, no servidor (só Anthropic). */
  serverFallback: boolean
}

const model = (
  provider: ProviderId,
  id: string,
  name: string,
  description: string,
  serverFallback = false,
): ModelInfo => ({ id, name, provider, description, serverFallback })

/**
 * Lista inicial de cada provedor. Os ids mudam rápido; "Atualizar modelos" nas
 * configurações busca a lista real da conta e complementa esta.
 */
export const MODELS: ModelInfo[] = [
  model("anthropic", "claude-opus-5-5", "Claude Opus 5.5", "Padrão. Bom em código e tarefas longas.", true),
  model("anthropic", "claude-sonnet-5-5", "Claude Sonnet 5.5", "Mais rápido e metade do preço do Opus.", true),
  model("anthropic", "claude-haiku-5-5", "Claude Haiku 5.5", "O mais rápido e barato, para perguntas simples."),
  model("anthropic", "claude-fable-5-1", "Claude Fable 5.1", "O mais capaz. Mais lento e o mais caro.", true),
  model("openai", "gpt-6-astra", "GPT-6 Astra", "O mais capaz da OpenAI."),
  model("openai", "gpt-6.1-sol", "GPT-6.1 Sol", "Perto do Astra, por menos."),
  model("openai", "gpt-6.1-terra", "GPT-6.1 Terra", "Rápido e barato."),
  model("google", "gemini-4-argon", "Gemini 4 Argon", "O mais capaz do Google."),
  model("google", "gemini-3.8-flash", "Gemini 3.8 Flash", "Rápido, bom custo-benefício."),
  model("google", "gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite", "O mais leve e barato."),
]

export const DEFAULT_MODEL_ID = MODELS[0].id

/** Provedor de um id que não está na lista (modelo descoberto ou fallback). */
function inferProvider(id: string): ProviderId | null {
  if (id.startsWith("claude")) return "anthropic"
  if (id.startsWith("gemini")) return "google"
  if (/^(gpt|o\d|chatgpt)/.test(id)) return "openai"
  return null
}

/** Modelo pelo id; ids desconhecidos de provedor reconhecível viram um modelo genérico. */
export function getModel(id: string | undefined): ModelInfo {
  const known = MODELS.find((m) => m.id === id)
  if (known) return known
  const provider = id ? inferProvider(id) : null
  return provider && id ? model(provider, id, id, "Modelo da sua conta.") : MODELS[0]
}

/** Nome para exibir; modelos fora da lista aparecem pelo id. */
export function modelName(id: string): string {
  return MODELS.find((m) => m.id === id)?.name ?? id
}

/** Modelos de um provedor: os da lista inicial e depois os descobertos na conta. */
export function modelsFor(provider: ProviderId, discovered: string[] = []): ModelInfo[] {
  const builtIn = MODELS.filter((m) => m.provider === provider)
  const extra = discovered.filter((id) => !builtIn.some((m) => m.id === id)).map((id) => getModel(id))
  return [...builtIn, ...extra]
}

export type AgentMessage =
  | {
      role: "user"
      text: string
      /** Contexto (diretório, branch) enviado junto quando mudou; não aparece no chat. */
      context?: string
    }
  | {
      role: "assistant"
      text: string
      modelId: string
      /** Comando sugerido, executável no terminal com um clique. */
      command?: string
      /** Blocos crus do provedor, reenviados sem alteração nos próximos turnos. */
      raw?: unknown
    }
  /** Aviso local (erro, recusa, interrupção). Nunca vai para o modelo. */
  | { role: "note"; text: string; tone: "error" | "info"; link?: NoteLink }

export interface NoteLink {
  label: string
  url: string
}

export interface AgentRequest {
  model: ModelInfo
  system: string
  history: AgentMessage[]
  signal: AbortSignal
  /** Texto chegando em streaming. */
  onText: (delta: string) => void
  /** O texto exibido até aqui foi descartado (troca de modelo no meio da resposta). */
  onReset: () => void
}

export type AgentReply =
  | { kind: "answer"; text: string; command?: string; raw: unknown; servedBy: string; truncated: boolean }
  | { kind: "refusal"; category: string | null }

export interface AgentProvider {
  id: ProviderId
  send(request: AgentRequest): Promise<AgentReply>
  /** Valida a credencial com uma chamada barata. */
  test(): Promise<void>
  /** Ids dos modelos de chat disponíveis na conta. */
  listModels(): Promise<string[]>
}

export class AgentError extends Error {
  constructor(
    message: string,
    /** Página onde o usuário resolve o problema (ex.: cobrança do provedor). */
    readonly link?: NoteLink,
  ) {
    super(message)
  }
}

const providers = new Map<ProviderId, AgentProvider>()

export function registerAgentProvider(provider: AgentProvider) {
  providers.set(provider.id, provider)
}

export function getProvider(id: ProviderId): AgentProvider {
  const provider = providers.get(id)
  if (!provider) throw new AgentError(`Provedor ${id} não registrado.`)
  return provider
}

/** A mensagem do assistente veio deste provedor? Só então os blocos crus podem voltar. */
export function isFromProvider(message: Extract<AgentMessage, { role: "assistant" }>, provider: ProviderId) {
  return getModel(message.modelId).provider === provider
}

export function missingKeyError(provider: ProviderId): AgentError {
  const info = getProviderInfo(provider)
  return new AgentError(
    `Nenhuma chave da ${info.vendor} configurada. Adicione uma em Configurações > Provedor de IA > ${info.name}.`,
  )
}

const SHELL_BLOCK = /```(?:sh|bash|zsh|shell|console|powershell|pwsh|ps1)\n([\s\S]*?)```/g

/** Extrai o último bloco de shell da resposta, para o botão "Executar no terminal". */
export function extractCommand(text: string): string | undefined {
  const last = [...text.matchAll(SHELL_BLOCK)].at(-1)
  return last?.[1]?.trim() || undefined
}

/** Texto para exibir: sem o bloco que virou o cartão de comando. */
export function withoutCommandBlock(text: string): string {
  const last = [...text.matchAll(SHELL_BLOCK)].at(-1)
  if (last?.index === undefined) return text
  return (text.slice(0, last.index) + text.slice(last.index + last[0].length)).trim()
}
