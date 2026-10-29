import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import { Terminal } from "@xterm/xterm"
import type { UnlistenFn } from "@tauri-apps/api/event"
import { openUrl } from "@tauri-apps/plugin-opener"

import { pty } from "@/lib/pty"
import { xtermThemes } from "@/lib/xterm-theme"
import type { ThemeName } from "@/state/types"

/**
 * Mantém uma instância de xterm + sessão PTY por painel, fora do ciclo de vida
 * do React. Assim uma aba pode virar painel de grid (ou o contrário) sem perder
 * o scrollback nem reiniciar o shell: o `TerminalView` só pendura o `host` no
 * container dele.
 */
export interface TerminalHandle {
  term: Terminal
  fit: FitAddon
  host: HTMLDivElement
  cwd: string
  sessionId: string | null
  exited: boolean
  opened: boolean
  unlisten: UnlistenFn[]
  pendingInput: string[]
}

const handles = new Map<string, TerminalHandle>()
/** Texto enviado a um painel que ainda não montou (ex.: workflow numa aba nova). */
const queuedBeforeMount = new Map<string, string[]>()
let currentTheme: ThemeName = "dark"

function createHandle(paneId: string, cwd: string): TerminalHandle {
  const term = new Terminal({
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 13.5,
    lineHeight: 1.25,
    cursorBlink: true,
    allowProposedApi: false,
    scrollback: 10_000,
    macOptionIsMeta: true,
    theme: xtermThemes[currentTheme],
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new WebLinksAddon((_event, uri) => void openUrl(uri)))

  const host = document.createElement("div")
  host.className = "h-full w-full"

  const handle: TerminalHandle = {
    term,
    fit,
    host,
    cwd,
    sessionId: null,
    exited: false,
    opened: false,
    unlisten: [],
    pendingInput: queuedBeforeMount.get(paneId) ?? [],
  }
  queuedBeforeMount.delete(paneId)

  term.onData((data) => {
    if (handle.exited) {
      if (data === "\r") void restart(paneId)
      return
    }
    if (!handle.sessionId) {
      handle.pendingInput.push(data)
      return
    }
    void pty.write(handle.sessionId, data)
  })

  // Shift+Enter quebra linha sem executar: manda ESC+CR, o mesmo que Alt+Enter.
  // O zsh insere um "\n" no buffer (self-insert-unmeta) e CLIs como o Claude Code
  // tratam a sequência como nova linha.
  term.attachCustomKeyEventHandler((event) => {
    const isShiftEnter =
      event.key === "Enter" && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey
    if (!isShiftEnter) return true
    if (event.type === "keydown") term.input("\x1b\r", true)
    return false
  })

  term.onResize(({ cols, rows }) => {
    if (handle.sessionId) void pty.resize(handle.sessionId, cols, rows)
  })

  handles.set(paneId, handle)
  return handle
}

async function startSession(handle: TerminalHandle): Promise<void> {
  const { term } = handle
  try {
    const sessionId = await pty.create(handle.cwd, term.cols, term.rows)
    // O painel pode ter sido fechado enquanto o PTY subia.
    if (!isAlive(handle)) {
      await pty.close(sessionId)
      return
    }
    handle.unlisten.push(
      await pty.onOutput(sessionId, (data) => term.write(data)),
      await pty.onExit(sessionId, () => markExited(handle)),
    )
    handle.sessionId = sessionId
    handle.exited = false
    await pty.attach(sessionId)
    for (const data of handle.pendingInput.splice(0)) {
      await pty.write(sessionId, data)
    }
  } catch (error) {
    term.writeln(`\x1b[31mNão foi possível abrir o shell: ${String(error)}\x1b[0m`)
    handle.exited = true
  }
}

function markExited(handle: TerminalHandle) {
  handle.unlisten.splice(0).forEach((fn) => fn())
  handle.sessionId = null
  handle.exited = true
  handle.term.writeln("\r\n\x1b[90m[processo encerrado · Enter para reabrir]\x1b[0m")
}

async function restart(paneId: string) {
  const handle = handles.get(paneId)
  if (!handle) return
  handle.exited = false
  handle.term.reset()
  await startSession(handle)
}

function isAlive(handle: TerminalHandle): boolean {
  return [...handles.values()].includes(handle)
}

export const terminalRegistry = {
  /** Pendura o terminal do painel em `container`, criando-o se for a primeira vez. */
  mount(paneId: string, cwd: string, container: HTMLElement): TerminalHandle {
    const handle = handles.get(paneId) ?? createHandle(paneId, cwd)
    container.appendChild(handle.host)
    if (!handle.opened) {
      handle.term.open(handle.host)
      handle.opened = true
      safeFit(handle)
      void startSession(handle)
    }
    return handle
  },

  get(paneId: string): TerminalHandle | undefined {
    return handles.get(paneId)
  },

  fit(paneId: string) {
    const handle = handles.get(paneId)
    if (handle) safeFit(handle)
  },

  focus(paneId: string) {
    handles.get(paneId)?.term.focus()
  },

  /** Escreve no shell como se o usuário tivesse digitado. */
  send(paneId: string, text: string) {
    const handle = handles.get(paneId)
    if (!handle) {
      queuedBeforeMount.set(paneId, [...(queuedBeforeMount.get(paneId) ?? []), text])
      return
    }
    if (handle.sessionId) void pty.write(handle.sessionId, text)
    else handle.pendingInput.push(text)
  },

  dispose(paneId: string) {
    queuedBeforeMount.delete(paneId)
    const handle = handles.get(paneId)
    if (!handle) return
    handles.delete(paneId)
    handle.unlisten.splice(0).forEach((fn) => fn())
    if (handle.sessionId) void pty.close(handle.sessionId)
    handle.term.dispose()
    handle.host.remove()
  },

  setTheme(theme: ThemeName) {
    currentTheme = theme
    for (const handle of handles.values()) handle.term.options.theme = xtermThemes[theme]
  },
}

function safeFit(handle: TerminalHandle) {
  // Com o container oculto (display:none) o fit calcularia 0 colunas.
  if (handle.host.clientWidth === 0 || handle.host.clientHeight === 0) return
  try {
    handle.fit.fit()
  } catch {
    // O renderer ainda não mediu a fonte; o próximo ResizeObserver resolve.
  }
}
