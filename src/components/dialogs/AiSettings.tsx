import { useCallback, useEffect, useState, type FormEvent } from "react"
import { ExternalLink, KeyRound, RefreshCw, Sparkles } from "lucide-react"
import { openUrl } from "@tauri-apps/plugin-opener"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AgentError,
  getModel,
  getProvider,
  modelsFor,
  PROVIDERS,
  type ProviderId,
  type ProviderInfo,
} from "@/lib/agents"
import { secrets, type ApiKeyStatus } from "@/lib/secrets"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/state/workspace-context"

/** Abas Claude / GPT / Gemini: chave de cada provedor e escolha do modelo padrão. */
export function AiSettings() {
  const { state } = useWorkspace()
  const current = getModel(state.settings.modelId)
  const [tab, setTab] = useState<ProviderId>(current.provider)

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">Provedor de IA</span>
        <span className="text-xs text-dim">em uso: {current.name}</span>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as ProviderId)} className="gap-3">
        <TabsList className="w-full">
          {PROVIDERS.map((provider) => (
            <TabsTrigger key={provider.id} value={provider.id} className="gap-1.5">
              {provider.name}
              {provider.id === current.provider && (
                <span className="size-1.5 rounded-full bg-success" aria-label="em uso" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {PROVIDERS.map((provider) => (
          <TabsContent key={provider.id} value={provider.id} className="flex flex-col gap-3">
            <ProviderPanel provider={provider} />
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-xs text-dim">Cada chat de agente também pode trocar de modelo no cabeçalho.</p>
    </section>
  )
}

type Feedback = { tone: "ok" | "error"; text: string } | null

function errorText(error: unknown): string {
  return error instanceof AgentError ? error.message : String(error)
}

function ProviderPanel({ provider }: { provider: ProviderInfo }) {
  const { state, dispatch } = useWorkspace()
  const [keyStatus, setKeyStatus] = useState<ApiKeyStatus | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState<"save" | "test" | "models" | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const discovered = state.settings.discoveredModels[provider.id]
  const models = modelsFor(provider.id, discovered)
  const hasKey = keyStatus !== null && keyStatus.source !== "none"

  const refresh = useCallback(() => {
    secrets
      .status(provider.id)
      .then(setKeyStatus)
      .catch((error) => setFeedback({ tone: "error", text: String(error) }))
  }, [provider.id])

  useEffect(refresh, [refresh])

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<Feedback>) {
    setBusy(kind)
    setFeedback(null)
    try {
      setFeedback(await action())
    } catch (error) {
      setFeedback({ tone: "error", text: errorText(error) })
    } finally {
      setBusy(null)
    }
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    void run("save", async () => {
      try {
        await secrets.set(provider.id, draft)
      } catch (error) {
        throw new AgentError(`Não foi possível salvar no cofre do sistema: ${String(error)}`)
      }
      setDraft("")
      refresh()
      return { tone: "ok", text: "Chave salva." }
    })
  }

  const remove = () =>
    void run("save", async () => {
      await secrets.delete(provider.id)
      refresh()
      return null
    })

  const test = () =>
    void run("test", async () => {
      await getProvider(provider.id).test()
      return { tone: "ok", text: "Conexão funcionando." }
    })

  const refreshModels = () =>
    void run("models", async () => {
      const ids = await getProvider(provider.id).listModels()
      dispatch({
        type: "settings/update",
        patch: { discoveredModels: { ...state.settings.discoveredModels, [provider.id]: ids } },
      })
      return { tone: "ok", text: `${ids.length} modelos disponíveis nesta conta.` }
    })

  const sourceLabel =
    keyStatus?.source === "keychain"
      ? `Chave salva no cofre do sistema (termina em ${keyStatus.hint})`
      : keyStatus?.source === "env"
        ? `Usando ${provider.envVar} do ambiente (termina em ${keyStatus.hint})`
        : "Nenhuma chave configurada"

  return (
    <>
      <div className="flex items-center gap-2 text-[13px]">
        <KeyRound className={cn("size-3.5", hasKey ? "text-success" : "text-dim")} />
        <span className={cn(!hasKey && "text-muted-foreground")}>{sourceLabel}</span>
        {keyStatus?.source === "keychain" && (
          <Button variant="link" size="xs" className="text-dim hover:text-destructive" onClick={remove}>
            Remover
          </Button>
        )}
      </div>

      <form onSubmit={save} className="flex items-center gap-2">
        <Input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`${keyStatus?.source === "keychain" ? "Substituir chave" : "Chave de API"} (${provider.keyPlaceholder})`}
          aria-label={`Chave de API da ${provider.vendor}`}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 font-mono text-[12.5px]"
        />
        <Button type="submit" variant="outline" size="sm" disabled={!draft.trim() || busy !== null}>
          Salvar
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!hasKey || busy !== null} onClick={test}>
          {busy === "test" ? "Testando…" : "Testar"}
        </Button>
      </form>

      {feedback && (
        <p className={cn("text-xs", feedback.tone === "ok" ? "text-success" : "text-destructive")}>{feedback.text}</p>
      )}

      <button
        type="button"
        onClick={() => void openUrl(provider.keyUrl)}
        className="flex w-fit items-center gap-1 text-xs text-dim hover:text-foreground"
      >
        Criar uma chave na {provider.vendor}
        <ExternalLink className="size-3" />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Modelo padrão</span>
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto text-dim"
          disabled={!hasKey || busy !== null}
          onClick={refreshModels}
        >
          <RefreshCw className={cn(busy === "models" && "animate-spin")} />
          Atualizar modelos
        </Button>
      </div>
      <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-auto">
        {models.map((model) => {
          const selected = state.settings.modelId === model.id
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => dispatch({ type: "settings/update", patch: { modelId: model.id } })}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left hover:bg-accent",
                selected && "border-primary",
              )}
            >
              <span className={cn("flex items-center gap-1.5 text-[13px] font-medium", selected && "text-primary")}>
                <Sparkles className="size-3.5" />
                {model.name}
              </span>
              <span className="text-xs text-muted-foreground">{model.description}</span>
            </button>
          )
        })}
      </div>
      {!hasKey && (
        <p className="text-xs text-dim">Para usar o {provider.name}, salve uma chave e escolha um modelo.</p>
      )}
    </>
  )
}
