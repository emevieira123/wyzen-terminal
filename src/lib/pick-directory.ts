import { open } from "@tauri-apps/plugin-dialog"

/** Seletor nativo de pasta. Devolve `null` se o usuário cancelar. */
export async function pickDirectory(defaultPath?: string): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath?.startsWith("~") ? undefined : defaultPath,
  })
  return typeof selected === "string" ? selected : null
}
