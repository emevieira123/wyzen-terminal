import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import { terminalRegistry } from "@/lib/terminal-registry"

interface TerminalViewProps {
  paneId: string
  cwd: string
  /** Recebe o foco do teclado ao montar e quando passa a `true`. */
  focused?: boolean
  className?: string
}

/**
 * Exibe o xterm do painel. A instância `Terminal` + `FitAddon` e a sessão PTY
 * vivem no `terminalRegistry`; aqui só anexamos o elemento à `ref`, mantemos o
 * tamanho sincronizado com o PTY e devolvemos o foco.
 */
export function TerminalView({ paneId, cwd, focused = true, className }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handle = terminalRegistry.mount(paneId, cwd, container)

    // fit() recalcula cols/rows; o onResize do xterm repassa para resize_pty.
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => terminalRegistry.fit(paneId))
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      // Desanexa sem destruir: o painel pode estar só mudando de lugar.
      if (handle.host.parentElement === container) container.removeChild(handle.host)
    }
    // cwd só importa na criação; mudanças depois são feitas com `cd` no shell.
  }, [paneId])

  useEffect(() => {
    if (!focused) return
    // Adiado pelo mesmo motivo do AgentView: menus fechando roubam o foco.
    const timer = setTimeout(() => {
      if (!isTypingElsewhere()) terminalRegistry.focus(paneId)
    })
    return () => clearTimeout(timer)
  }, [focused, paneId])

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full min-h-0 min-w-0 overflow-hidden bg-background", className)}
    />
  )
}

/** O usuário está digitando em outro campo (ex.: renomeando uma aba)? Então não roubamos o foco. */
function isTypingElsewhere(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement) || el.closest(".xterm")) return false
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable
}
