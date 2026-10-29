import { Combine, FolderOpen, LayoutGrid, Play, Settings, SunMoon, Sparkles } from "lucide-react"

import { PaneIcon } from "@/components/PaneIcon"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { MODELS } from "@/lib/agents"
import { shortcutLabel } from "@/lib/platform"
import { useWorkspace } from "@/state/workspace-context"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenSettings: () => void
  onChangeDirectory: () => void
}

export function CommandPalette({ open, onOpenChange, onOpenSettings, onChangeDirectory }: CommandPaletteProps) {
  const { state, dispatch, runCommand } = useWorkspace()
  const { theme } = state.settings

  const run = (fn: () => void) => () => {
    onOpenChange(false)
    fn()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Paleta de comandos" className="sm:max-w-xl">
      {/* O CommandDialog desta versão do shadcn não inclui o <Command> do cmdk. */}
      <Command>
        <CommandInput placeholder="Comandos, workflows, projetos, IA…" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup heading="Ações">
            <CommandItem onSelect={run(() => dispatch({ type: "tab/new", kind: "terminal" }))}>
              <PaneIcon kind="terminal" />
              Novo terminal
              <CommandShortcut>{shortcutLabel("T")}</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={run(() => dispatch({ type: "tab/new", kind: "agent" }))}>
              <PaneIcon kind="agent" />
              Novo agente de IA
              <CommandShortcut>{shortcutLabel("A", { shift: true })}</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={run(() => dispatch({ type: "tab/newGrid" }))}>
              <LayoutGrid />
              Novo grid (até 6 painéis)
            </CommandItem>
            <CommandItem onSelect={run(() => dispatch({ type: "tab/groupIntoGrid" }))}>
              <Combine />
              Agrupar abas abertas em grid
            </CommandItem>
            <CommandItem onSelect={run(onChangeDirectory)}>
              <FolderOpen />
              Alterar diretório do terminal
            </CommandItem>
            <CommandItem
              onSelect={run(() =>
                dispatch({ type: "settings/update", patch: { theme: theme === "dark" ? "light" : "dark" } }),
              )}
            >
              <SunMoon />
              {theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
            </CommandItem>
            <CommandItem onSelect={run(onOpenSettings)}>
              <Settings />
              Abrir configurações
              <CommandShortcut>{shortcutLabel(",")}</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="Projetos">
            {state.projects.map((project) => (
              <CommandItem
                key={project.id}
                value={`projeto ${project.name} ${project.path}`}
                onSelect={run(() => dispatch({ type: "project/select", projectId: project.id }))}
              >
                <span className="size-2 rounded-[2px]" style={{ background: project.color }} />
                Ir para {project.name}
                <CommandShortcut className="font-mono tracking-normal">{project.path}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          {state.workflows.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Workflows">
                {state.workflows.map((workflow) => (
                  <CommandItem
                    key={workflow.id}
                    value={`workflow ${workflow.name} ${workflow.cmd}`}
                    onSelect={run(() => runCommand(workflow.cmd))}
                  >
                    <Play />
                    {workflow.name}
                    <CommandShortcut className="max-w-56 truncate font-mono tracking-normal">
                      {workflow.cmd}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="Modelo">
            {MODELS.map((model) => (
              <CommandItem
                key={model.id}
                value={`modelo ${model.name} ${model.vendor}`}
                onSelect={run(() => dispatch({ type: "settings/update", patch: { modelId: model.id } }))}
              >
                <Sparkles className="text-ai" />
                Usar {model.name}
                <CommandShortcut>{model.vendor}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
