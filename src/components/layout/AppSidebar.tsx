import { useState } from "react"
import { Folder as FolderIcon, FolderPlus, Play, Plus, Settings } from "lucide-react"

import { ProjectTree } from "@/components/layout/ProjectTree"
import { ModelSelect } from "@/components/ModelSelect"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { shortcutLabel } from "@/lib/platform"
import { newId } from "@/state/workspace-reducer"
import { useWorkspace } from "@/state/workspace-context"

interface AppSidebarProps {
  onAddProject: () => void
  onOpenSettings: () => void
}

export function AppSidebar({ onAddProject, onOpenSettings }: AppSidebarProps) {
  const { state, dispatch, runCommand } = useWorkspace()
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)

  // A pasta nova já abre com o nome em edição.
  function addFolder() {
    const folderId = newId()
    dispatch({ type: "folder/add", folderId, name: "Nova pasta" })
    setRenamingFolderId(folderId)
  }

  return (
    // O container do Sidebar é `fixed`; encaixamos entre a barra de título e a de status.
    <Sidebar className="top-11 bottom-7 h-auto">
      <SidebarContent className="gap-3 px-1.5 pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] tracking-[.08em] text-dim uppercase">
            Projetos
          </SidebarGroupLabel>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarGroupAction title="Adicionar projeto ou pasta">
                <Plus />
              </SidebarGroupAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" onCloseAutoFocus={(event) => event.preventDefault()}>
              <DropdownMenuItem onSelect={onAddProject}>
                <FolderPlus />
                Novo projeto
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={addFolder}>
                <FolderIcon />
                Nova pasta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SidebarGroupContent>
            <ProjectTree renamingFolderId={renamingFolderId} onRenameDone={() => setRenamingFolderId(null)} />
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
