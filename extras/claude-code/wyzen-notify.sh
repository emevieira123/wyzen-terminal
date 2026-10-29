#!/bin/bash
# Hook do Claude Code para o Wyzen Terminal: avisa quando o Claude termina uma
# tarefa (Stop) ou precisa de você (Notification). Devolve uma sequência OSC 777
# que o próprio Claude Code escreve no terminal; o Wyzen mostra o toast.
#
# Fora do Wyzen não faz nada, para não interferir em outros terminais.
# Requer jq. Instalação: veja o README do projeto.

[ "$TERM_PROGRAM" = "WyzenTerminal" ] || exit 0
command -v jq >/dev/null || exit 0

input=$(cat)
event=$(jq -r '.hook_event_name // empty' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
project=${cwd##*/}

case "$event" in
  Stop) body="Terminou a tarefa${project:+ em $project}" ;;
  Notification) body=$(jq -r '.message // "Precisa da sua atenção"' <<<"$input") ;;
  *) exit 0 ;;
esac

# No OSC 777 o ";" separa campos, e caracteres de controle quebrariam a sequência.
body=$(printf '%s' "$body" | tr -d '\000-\037' | tr ';' ',')
seq=$(printf '\033]777;notify;Claude Code;%s\007' "$body")
jq -nc --arg seq "$seq" '{terminalSequence: $seq}'
