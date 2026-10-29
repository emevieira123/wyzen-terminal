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

## Ligando um agente de IA

Nenhum provedor vem configurado. Implemente `AgentProvider` e registre no `main.tsx`:

```ts
import { registerAgentProvider } from "@/lib/agents"

registerAgentProvider({
  id: "claude-sonnet",
  async send(messages, context, signal) {
    // chame a API do fornecedor, um CLI local ou um command Rust
    return { text: "…", command: "pnpm test" }
  },
})
```

O `command` devolvido aparece com o botão "Executar no terminal".
