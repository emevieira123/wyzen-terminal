/**
 * Trabalho a fazer antes de o app reiniciar (ex.: salvar a sessão com os
 * diretórios atuais dos terminais). Quem reinicia (o updater) chama
 * `runBeforeRestart`; o estado do workspace registra o que fazer.
 */
let beforeRestart: (() => Promise<void>) | null = null

export function setBeforeRestart(fn: (() => Promise<void>) | null) {
  beforeRestart = fn
}

export async function runBeforeRestart() {
  try {
    await beforeRestart?.()
  } catch {
    // Salvar a sessão não pode impedir a atualização.
  }
}
