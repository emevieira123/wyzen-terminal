import { relaunch } from "@tauri-apps/plugin-process"
import { check, type Update } from "@tauri-apps/plugin-updater"
import { toast } from "sonner"

/**
 * Atualização pelo app. O plugin lê o `latest.json` do último release
 * publicado no GitHub (endpoint em `tauri.conf.json`) e só aceita pacotes
 * assinados com a chave cujo par público está na mesma configuração.
 */

const TOAST_ID = "app-update"
let checking = false

export async function checkForUpdates({ manual = false } = {}): Promise<void> {
  if (checking) return
  checking = true
  try {
    const update = await check()
    if (update) offerUpdate(update)
    else if (manual) toast.success("Você já está na versão mais recente.")
  } catch (error) {
    // Na verificação automática, falta de rede ou release sem latest.json não merecem aviso.
    if (manual) toast.error("Não foi possível verificar atualizações.", { description: String(error) })
  } finally {
    checking = false
  }
}

function offerUpdate(update: Update) {
  toast(`Wyzen Terminal ${update.version} disponível`, {
    id: TOAST_ID,
    description: `Você está na ${update.currentVersion}. O app reinicia depois de instalar.`,
    duration: Number.POSITIVE_INFINITY,
    action: { label: "Atualizar", onClick: () => void install(update) },
    cancel: { label: "Depois", onClick: () => undefined },
  })
}

async function install(update: Update) {
  let total = 0
  let received = 0
  toast.loading("Baixando atualização…", { id: TOAST_ID, description: undefined })
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0
      if (event.event === "Progress") {
        received += event.data.chunkLength
        if (total > 0) {
          toast.loading(`Baixando atualização… ${Math.round((received / total) * 100)}%`, { id: TOAST_ID })
        }
      }
    })
    toast.loading("Reiniciando…", { id: TOAST_ID })
    await relaunch()
  } catch (error) {
    toast.error("A atualização falhou.", { id: TOAST_ID, description: String(error), duration: 10_000 })
  }
}
