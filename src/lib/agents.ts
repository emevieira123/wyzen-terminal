/**
 * Ponto de integração com agentes de IA.
 *
 * Cada modelo listado em `MODELS` resolve para um `AgentProvider` registrado
 * com `registerAgentProvider`. Nenhum provedor vem registrado: o app não guarda
 * chaves de API. Para ligar um modelo, implemente `send` (chamando a API do
 * fornecedor, um CLI local ou um command Rust) e registre-o no `main.tsx`.
 */

export interface AgentMessage {
  role: "user" | "assistant"
  text: string
  /** Comando sugerido pelo agente, que o usuário pode executar no terminal. */
  command?: string
}

export interface AgentContext {
  projectName: string
  cwd: string
  branch: string | null
}

export interface AgentReply {
  text: string
  command?: string
}

export interface AgentProvider {
  /** Deve bater com `ModelInfo.id`. */
  id: string
  send(messages: AgentMessage[], context: AgentContext, signal: AbortSignal): Promise<AgentReply>
}

export interface ModelInfo {
  id: string
  name: string
  vendor: string
}

export const MODELS: ModelInfo[] = [
  { id: "claude-sonnet", name: "Claude Sonnet", vendor: "Anthropic" },
  { id: "gpt-5", name: "GPT-5", vendor: "OpenAI" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", vendor: "Google" },
]

const providers = new Map<string, AgentProvider>()

export function registerAgentProvider(provider: AgentProvider) {
  providers.set(provider.id, provider)
}

export function getModel(id: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]
}

export async function sendToAgent(
  modelId: string,
  messages: AgentMessage[],
  context: AgentContext,
  signal: AbortSignal,
): Promise<AgentReply> {
  const provider = providers.get(modelId)
  if (!provider) {
    return {
      text: `Nenhum provedor configurado para ${getModel(modelId).name}. Registre um com registerAgentProvider em src/lib/agents.ts.`,
    }
  }
  return provider.send(messages, context, signal)
}
