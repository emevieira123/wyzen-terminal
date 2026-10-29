import type { Terminal } from "@xterm/xterm"

/**
 * Notificações que programas enviam pelo próprio terminal (sequências OSC),
 * no formato usado por iTerm2, Ghostty, Kitty e Windows Terminal. O hook do
 * Claude Code em `extras/claude-code/` envia OSC 777.
 */
export interface TerminalAlert {
  title: string | null
  body: string
}

type AlertHandler = (paneId: string, alert: TerminalAlert) => void

let handler: AlertHandler | null = null

/** Quem exibe os avisos (o App) se registra aqui. */
export function setTerminalAlertHandler(next: AlertHandler | null) {
  handler = next
}

/** OSC 9 ; mensagem. Subcomandos numéricos (ex.: 9;4 = progresso) não são avisos. */
export function parseOsc9(data: string): TerminalAlert | null {
  if (!data.trim() || /^\d+;/.test(data)) return null
  return { title: null, body: data }
}

/** OSC 777 ; notify ; título ; corpo */
export function parseOsc777(data: string): TerminalAlert | null {
  const [kind, title = "", ...rest] = data.split(";")
  if (kind !== "notify") return null
  const body = rest.join(";")
  if (!title && !body) return null
  return { title: title || null, body }
}

/** OSC 99 ; metadados ; texto (Kitty). Suporta o caso simples, sem fragmentação. */
export function parseOsc99(data: string): TerminalAlert | null {
  const split = data.indexOf(";")
  if (split < 0) return null
  const meta = data.slice(0, split)
  const text = data.slice(split + 1)
  if (!text) return null
  return /(^|:)p=body(:|$)/.test(meta) ? { title: null, body: text } : { title: text, body: "" }
}

/** Liga os parsers ao xterm de um painel. */
export function watchTerminalAlerts(term: Terminal, paneId: string) {
  const emit = (alert: TerminalAlert | null) => {
    if (alert) handler?.(paneId, alert)
    // true: a sequência foi tratada e não deve aparecer no terminal.
    return true
  }
  term.parser.registerOscHandler(9, (data) => emit(parseOsc9(data)))
  term.parser.registerOscHandler(777, (data) => emit(parseOsc777(data)))
  term.parser.registerOscHandler(99, (data) => emit(parseOsc99(data)))
}

let audio: AudioContext | null = null

/** Dois tons curtos gerados na hora; sem arquivo de áudio no bundle. */
export function playChime() {
  try {
    audio ??= new AudioContext()
    const start = audio.currentTime
    for (const [offset, frequency] of [
      [0, 880],
      [0.12, 1320],
    ]) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = "sine"
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.35)
      osc.connect(gain).connect(audio.destination)
      osc.start(start + offset)
      osc.stop(start + offset + 0.4)
    }
  } catch {
    // Sem áudio disponível: o aviso visual basta.
  }
}
