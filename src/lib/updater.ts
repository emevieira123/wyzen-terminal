import { useSyncExternalStore } from "react"
import { relaunch } from "@tauri-apps/plugin-process"
import { check, type Update } from "@tauri-apps/plugin-updater"
import { toast } from "sonner"

import { runBeforeRestart } from "@/lib/restart"

/**
 * Atualização pelo app. O plugin lê o `latest.json` do último release
 * publicado no GitHub (endpoint em `tauri.conf.json`) e só aceita pacotes
 * assinados com a chave cujo par público está na mesma configuração.
 *
 * "Atualizar" não reinicia direto: pede confirmação pelo `UpdateDialog`,
 * que verifica se há programas rodando nos terminais.
 */

const TOAST_ID = "app-update"
let checking = false
/** Versão já instalada para a próxima abertura; não precisa ser oferecida de novo. */
let installedVersion: string | null = null

let requested: Update | null = null
const listeners = new Set<() => void>()

function setRequested(update: Update | null) {
  requested = update
  for (const listener of listeners) listener()
}

/** Atualização que o usuário pediu para instalar e aguarda confirmação. */
export function useRequestedUpdate(): Update | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => requested,
  )
}

export function dismissUpdateRequest() {
  setRequested(null)
}

export async function checkForUpdates({ manual = false } = {}): Promise<void> {
  if (checking) return
  checking = true
  try {
    const update = await check()
    if (update && update.version !== installedVersion) offerUpdate(update)
    else if (manual && installedVersion) toast.info(`A versão ${installedVersion} entra na próxima vez que você abrir o app.`)
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
    description: `Você está na ${update.currentVersion}.`,
    duration: Number.POSITIVE_INFINITY,
    action: { label: "Atualizar", onClick: () => setRequested(update) },
    cancel: { label: "Depois", onClick: () => undefined },
  })
}

async function download(update: Update): Promise<void> {
  let total = 0
  let received = 0
  toast.loading("Baixando atualização…", { id: TOAST_ID, description: undefined })
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") total = event.data.contentLength ?? 0
    if (event.event === "Progress") {
      received += event.data.chunkLength
      if (total > 0) toast.loading(`Baixando atualização… ${Math.round((received / total) * 100)}%`, { id: TOAST_ID })
    }
  })
}

/** Salva a sessão, instala e reinicia. No Windows o instalador fecha o app sozinho. */
export async function restartNow(update: Update) {
  setRequested(null)
  try {
    // Antes de instalar: no Windows o instalador encerra o app no meio do processo.
    await runBeforeRestart()
    await download(update)
    toast.loading("Reiniciando…", { id: TOAST_ID })
    await relaunch()
  } catch (error) {
    toast.error("A atualização falhou.", { id: TOAST_ID, description: String(error), duration: 10_000 })
  }
}

/**
 * Instala sem reiniciar (macOS e Linux): o app em uso continua aberto e a
 * versão nova entra na próxima abertura.
 */
export async function installForNextLaunch(update: Update) {
  setRequested(null)
  try {
    await download(update)
    installedVersion = update.version
    toast.success(`Versão ${update.version} instalada`, {
      id: TOAST_ID,
      description: "Ela entra na próxima vez que você abrir o Wyzen.",
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: "Reiniciar agora",
        onClick: async () => {
          await runBeforeRestart()
          await relaunch()
        },
      },
      cancel: { label: "OK", onClick: () => undefined },
    })
  } catch (error) {
    toast.error("A atualização falhou.", { id: TOAST_ID, description: String(error), duration: 10_000 })
  }
}
