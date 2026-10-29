import { MoreHorizontal, Play, Plus, Settings } from "lucide-react"

import { ModelSelect } from "@/components/ModelSelect"
import { PaneIcon } from "@/components/PaneIcon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { shortcutLabel } from "@/lib/platform"
import { useWorkspace } from "@/state/workspace-context"

interface AppSidebarProps {
  onAddProject: () => void
  onOpenSettings: () => void
}

export function AppSidebar({ onAddProject, onOpenSettings }: AppSidebarProps) {
  const { state, dispatch, runCommand } = useWorkspace()

  return (
    // O container do Sidebar é `fixed`; encaixamos entre a barra de título e a de status.
    <Sidebar className="top-11 bottom-7 h-auto">
      <SidebarContent className="gap-3 px-1.5 pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] tracking-[.08em] text-dim uppercase">
            Projetos
          </SidebarGroupLabel>
          <SidebarGroupAction title="Adicionar projeto" onClick={onAddProject}>
            <Plus />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {state.projects.map((project) => {
                const count = state.tabs.filter((t) => t.projectId === project.id).length
                return (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      isActive={project.id === state.activeProjectId}
                      onClick={() => dispatch({ type: "project/select", projectId: project.id })}
                      tooltip={project.path}
                      className="text-[13px]"
                    >
                      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: project.color }} />
                      <span className="truncate">{project.name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="font-mono text-[11px] text-dim group-hover/menu-item:opacity-0">
                      {count}
                    </SidebarMenuBadge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction showOnHover aria-label={`Ações de ${project.name}`}>
                          <MoreHorizontal />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" onCloseAutoFocus={(event) => event.preventDefault()}>
                        <DropdownMenuItem
                          onSelect={() => {
                            dispatch({ type: "project/select", projectId: project.id })
                            dispatch({ type: "tab/new", kind: "terminal" })
                          }}
                        >
                          <PaneIcon kind="terminal" />
                          Novo terminal aqui
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={state.projects.length <= 1}
                          onSelect={() => dispatch({ type: "project/remove", projectId: project.id })}
                        >
                          Remover projeto
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {state.settings.showWorkflows && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] tracking-[.08em] text-dim uppercase">
              Workflows
            </SidebarGroupLabel>
            <SidebarGroupAction title="Gerenciar workflows" onClick={onOpenSettings}>
              <Plus />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {state.workflows.length === 0 && (
                  <p className="px-2 py-1 text-xs text-dim">Crie workflows em Configurações.</p>
                )}
                {state.workflows.map((workflow) => (
                  <SidebarMenuItem key={workflow.id}>
                    <SidebarMenuButton
                      onClick={() => runCommand(workflow.cmd)}
                      tooltip={workflow.cmd}
                      className="font-mono text-xs text-muted-foreground"
                    >
                      <span className="truncate">{workflow.name}</span>
                      <Play className="ml-auto size-3! text-dim" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        <div className="flex flex-col gap-1.5 rounded-lg border p-2.5">
          <span className="text-[11px] text-dim">Modelo padrão</span>
          <ModelSelect
            value={state.settings.modelId}
            onChange={(modelId) => dispatch({ type: "settings/update", patch: { modelId } })}
            className="w-full"
          />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onOpenSettings} className="text-[13px] text-muted-foreground">
              <Settings />
              Configurações
              <Kbd className="ml-auto">{shortcutLabel(",")}</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
