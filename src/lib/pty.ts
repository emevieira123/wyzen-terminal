import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

import { isWindows } from "@/lib/platform"

/** Wrappers tipados para os commands do `src-tauri/src/lib.rs`. */
export const pty = {
  create(cwd: string, cols?: number, rows?: number): Promise<string> {
    return invoke<string>("create_pty_session", { cwd, cols, rows })
  },
  attach(sessionId: string): Promise<void> {
    return invoke("attach_pty_session", { sessionId })
  },
  write(sessionId: string, data: string): Promise<void> {
    return invoke("write_to_pty", { sessionId, data })
  },
  resize(sessionId: string, cols: number, rows: number): Promise<void> {
    return invoke("resize_pty", { sessionId, cols, rows })
  },
  close(sessionId: string): Promise<void> {
    return invoke("close_pty_session", { sessionId })
  },
  onOutput(sessionId: string, handler: (data: string) => void): Promise<UnlistenFn> {
    return listen<string>(`pty-output-${sessionId}`, (event) => handler(event.payload))
  },
  onExit(sessionId: string, handler: () => void): Promise<UnlistenFn> {
    return listen(`pty-exit-${sessionId}`, () => handler())
  },
}

export function defaultShell(): Promise<string> {
  return invoke<string>("default_shell")
}

export function gitBranch(cwd: string): Promise<string | null> {
  return invoke<string | null>("git_branch", { cwd })
}

/**
 * Aspas simples para o shell da plataforma. Dentro de aspas simples, o
 * PowerShell escapa ' dobrando (''); zsh/bash fecham, escapam e reabrem ('\'').
 */
export function quotePath(path: string): string {
  const escaped = isWindows ? path.replaceAll("'", "''") : path.replaceAll("'", "'\\''")
  return `'${escaped}'`
}
