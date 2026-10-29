export const isMac = navigator.userAgent.includes("Mac")

/**
 * Atalhos globais. No macOS usam ⌘; nos outros sistemas Ctrl+Shift, porque
 * Ctrl+T/K/A sozinhos pertencem ao shell (readline).
 */
export function isModKey(event: KeyboardEvent): boolean {
  return isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && event.shiftKey
}

/** Rótulo do atalho: `shortcutLabel("T")` → "⌘T" ou "Ctrl+Shift+T". */
export function shortcutLabel(key: string, { shift = false } = {}): string {
  if (isMac) return `⌘${shift ? "⇧" : ""}${key}`
  return `Ctrl+Shift+${key}`
}
