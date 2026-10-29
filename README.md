# Wyzen Terminal

Terminal desktop com projetos agrupados, abas, grid de até 6 painéis e agentes de IA. Tauri v2 (Rust) no backend, React 19 + shadcn/ui no frontend. Visual baseado no protótipo "Terminal IA Protótipo" do Claude Design.

## Requisitos

- Rust estável (`rustup`)
- Node 22 e pnpm
- macOS: Xcode Command Line Tools

## Rodando

```sh
pnpm install
pnpm tauri dev      # app desktop com hot reload
pnpm tauri build    # bundle de produção
cd src-tauri && cargo test   # testes do backend
```

## Releases (macOS, Linux e Windows)

O workflow `.github/workflows/release.yml` compila nos runners do GitHub e anexa os instaladores a um release em rascunho:

| Sistema | Arquivos |
| --- | --- |
| macOS Apple Silicon e Intel | `.dmg` e `.app.tar.gz` |
| Linux | `.deb`, `.rpm` e `.AppImage` |
| Windows | `.exe` (NSIS) e `.msi` |

Para lançar uma versão:

1. Atualize a versão em `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json` (as três iguais).
2. Faça o commit e envie a tag: `git tag v0.2.0 && git push origin main v0.2.0`.
3. Quando os quatro jobs terminarem, revise o rascunho em Releases e publique.

Também dá para rodar pela aba Actions > Release > Run workflow, sem criar tag.

### Sessão

Abas, nomes, painéis, tamanhos do grid, pasta de cada terminal e conversas dos agentes são salvos e voltam quando o app abre de novo (inclusive depois de uma atualização). A pasta acompanha os `cd` feitos no shell (consultada a cada 10 segundos via `ps`/`lsof` no macOS e `/proc` no Linux). Os programas que estavam rodando não voltam: cada terminal reabre um shell novo na mesma pasta.

### Atualização pelo app

O app verifica o último release publicado ao abrir e a cada 6 horas (também em Configurações e na paleta, "Verificar atualizações"). Havendo versão nova, mostra um aviso. Em "Atualizar", se algum terminal tem programa rodando (ex.: `pnpm dev`, `claude`), o app lista quais e pergunta: **Reiniciar agora**, **Instalar e usar depois** (macOS e Linux: instala sem fechar, e a versão nova entra na próxima abertura) ou **Cancelar**. Sem nada rodando, reinicia direto. No Windows o instalador sempre fecha o app, então a confirmação aparece sempre que houver terminal aberto.

- O endpoint é `releases/latest/download/latest.json`, que o workflow gera. Ele só passa a valer quando o rascunho do release é **publicado**.
- Os pacotes são assinados. A chave pública está em `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). A privada fica fora do repositório, em `~/.tauri/wyzen-terminal.key`, com a senha em `~/.tauri/wyzen-terminal.key.password`, e no GitHub nos secrets `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Perder a chave privada impede atualizar quem já instalou: guarde uma cópia em lugar seguro (ex.: gerenciador de senhas).
- No Linux, só o `.AppImage` se atualiza sozinho; `.deb` e `.rpm` precisam do instalador novo.

Os instaladores saem sem assinatura. No macOS, o Gatekeeper bloqueia na primeira abertura (libere em Ajustes > Privacidade e Segurança). No Windows, o SmartScreen mostra um aviso ("Mais informações > Executar assim mesmo").

## Estrutura

```
src-tauri/
  src/lib.rs          commands Tauri e setup (plugins, estado, limpeza no exit)
  src/pty.rs          PtyManager: sessões portable-pty em Arc<Mutex<HashMap>>
  capabilities/       permissões da janela (eventos, drag, dialog, opener)
src/
  lib/pty.ts          wrappers tipados de invoke/listen
  lib/terminal-registry.ts  um xterm + PTY por painel, fora do React
  lib/agents.ts       interface AgentProvider e lista de modelos
  state/              tipos, reducer e context do workspace (persistido em localStorage)
  components/
    TerminalView.tsx  pendura o xterm, ResizeObserver → fit → resize_pty
    AgentView.tsx     chat com o agente; comandos sugeridos rodam no terminal
    GridView.tsx      3 colunas, até 6 terminais/agentes
    layout/           TitleBar (Tabs), AppSidebar (Sidebar), StatusBar
    dialogs/          paleta ⌘K, configurações, novo projeto
    ui/               componentes shadcn
```

## Backend

| Command | O que faz |
| --- | --- |
| `create_pty_session(cwd, cols?, rows?) -> sessionId` | abre o shell do usuário (login shell; PowerShell no Windows) |
| `attach_pty_session(sessionId)` | libera o fluxo de saída depois que o frontend registrou o listener |
| `write_to_pty(sessionId, data)` | envia entrada ao shell |
| `resize_pty(sessionId, cols, rows)` | redimensiona o PTY |
| `close_pty_session(sessionId)` | mata o processo e remove a sessão |
| `default_shell()` / `git_branch(cwd)` | dados da barra de status |

A saída chega pelo evento `pty-output-{sessionId}` e o fim do processo por `pty-exit-{sessionId}`. O leitor guarda bytes UTF-8 cortados entre duas leituras para não quebrar acentos.

O `attach` existe porque o shell imprime o prompt antes de o `listen` do frontend estar ativo. Sem ele, o primeiro prompt se perderia.

## Atalhos

No macOS: ⌘T terminal, ⌘⇧A agente, ⌘K paleta, ⌘, configurações, ⌘B sidebar. Em Windows e Linux os mesmos atalhos usam Ctrl+Shift, porque Ctrl+T/K/A pertencem ao shell.

No grid, arraste o espaço entre os painéis para redimensionar: entre colunas ajusta a largura, entre as linhas ajusta a altura. Duplo clique na divisória volta ao tamanho igual. Adicionar ou fechar um painel reorganiza o grid com tamanhos iguais.

Para renomear uma aba, dê um duplo clique nela ou use o botão direito > Renomear. Nos painéis do grid vale o mesmo: duplo clique no título ou botão direito no cabeçalho. Enter confirma, Esc cancela.

## Avisos dos terminais (Claude Code)

Programas podem avisar algo pelo próprio terminal com as sequências OSC 9, OSC 777 ou OSC 99 (o padrão de iTerm2, Ghostty, Kitty e Windows Terminal). Quando um aviso chega de uma aba que você não está olhando, o Wyzen mostra um toast com o nome da aba e o botão "Ver", toca um som, marca a aba (e o projeto na sidebar) e, com a janela fora de foco, envia uma notificação do sistema. Som e notificação do sistema podem ser desligados em Configurações.

Para o Claude Code avisar quando termina uma tarefa ou precisa de aprovação, use o hook em `extras/claude-code/wyzen-notify.sh` (requer `jq`):

```sh
mkdir -p ~/.claude/hooks
cp extras/claude-code/wyzen-notify.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/wyzen-notify.sh
```

E no `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command", "command": "~/.claude/hooks/wyzen-notify.sh" }] }
    ],
    "Notification": [
      {
        "matcher": "permission_prompt|elicitation_dialog|elicitation_url_dialog|agent_needs_input",
        "hooks": [{ "type": "command", "command": "~/.claude/hooks/wyzen-notify.sh" }]
      }
    ]
  }
}
```

O script só age quando `TERM_PROGRAM=WyzenTerminal`; em outros terminais não faz nada. O `idle_prompt` fica de fora do matcher porque repete, 60 segundos depois, o aviso que o `Stop` já deu.

## Agentes de IA

Três provedores, cada um com o SDK oficial e streaming: **Claude** (Anthropic, padrão), **GPT** (OpenAI) e **Gemini** (Google).

- **Configuração:** em Configurações > Provedor de IA há uma aba por provedor. Em cada uma você salva a chave, testa a conexão e escolhe o modelo padrão. O provedor em uso é o do modelo padrão (marcado com um ponto verde na aba).
- **Chaves:** ficam no cofre do sistema (Keychain no macOS, Credential Manager no Windows, Secret Service no Linux), nunca no `localStorage`. Sem chave salva, o app usa a variável de ambiente: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` ou `GEMINI_API_KEY` (também aceita `GOOGLE_API_KEY`).
- **Modelos:** cada provedor vem com uma lista inicial. "Atualizar modelos" busca na conta os modelos de chat disponíveis e acrescenta à lista. Cada chat pode trocar de modelo (e de provedor) no cabeçalho; o histórico vai junto como texto.
- **Comandos sugeridos:** o modelo é instruído a colocar comandos num bloco ```` ```sh ````; o último vira o botão "Executar no terminal".
- **Recusas:** no Claude, Opus 5.5, Sonnet 5.5 e Fable 5.1 usam `fallbacks: "default"`, que reexecuta no servidor uma resposta recusada pelos classificadores de segurança. Nos outros casos a recusa aparece no chat.
- **Histórico no Claude:** só cresce. As respostas voltam à API com os blocos originais (inclusive `thinking`), e o system prompt fica fixo por conversa. Mudanças de diretório ou branch vão como texto na mensagem do usuário.
- **OpenAI:** usa a Responses API com `store: false`; a conversa não fica guardada nos servidores da OpenAI.

Outro provedor entra implementando `AgentProvider` em `src/lib/providers/` e registrando no `main.tsx`.
