import { invoke } from "@tauri-apps/api/core"

import type { ProviderId } from "@/lib/agents"

/** Chaves de API no cofre do sistema (ver `src-tauri/src/secrets.rs`). */
export interface ApiKeyStatus {
  source: "keychain" | "env" | "none"
  hint: string | null
}

export const secrets = {
  get(provider: ProviderId): Promise<string | null> {
    return invoke<string | null>("get_api_key", { provider })
  },
  status(provider: ProviderId): Promise<ApiKeyStatus> {
    return invoke<ApiKeyStatus>("api_key_status", { provider })
  },
  set(provider: ProviderId, key: string): Promise<void> {
    return invoke("set_api_key", { provider, key })
  },
  delete(provider: ProviderId): Promise<void> {
    return invoke("delete_api_key", { provider })
  },
}
