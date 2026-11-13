import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { ChevronRight, Folder as FolderIcon, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { PaneIcon } from "@/components/PaneIcon"
import { RenameField } from "@/components/RenameField"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import type { Folder, Project } from "@/state/types"
import { useWorkspace } from "@/state/workspace-context"

/**
 * Projetos e pastas da sidebar. Arrastar um projeto para uma pasta o coloca
 * dentro dela; para outro projeto, o posiciona antes dele (na pasta daquele);
 * para a área "fora das pastas", tira da pasta.
 *
 * Ids de arrastar/soltar: `project:<id>`, `folder:<id>` e `root`.
 */
export function ProjectTree({
  renamingFolderId,
  onRenameDone,
}: {
  renamingFolderId: string | null
  onRenameDone: () => void
}) {
  const { state, dispatch } = useWorkspace()
  const [dragging, setDragging] = useState<Project | null>(null)
  // Distância mínima: sem ela, todo clique viraria um arraste e não selecionaria o projeto.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const rootProjects = state.projects.filter((p) => !p.folderId || !state.folders.some((f) => f.id === p.folderId))

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id).replace(/^project:/, "")
    setDragging(state.projects.find((p) => p.id === id) ?? null)
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null)
    const projectId = String(event.active.id).replace(/^project:/, "")
    const target = event.over ? String(event.over.id) : null
    if (!target) return
    if (target === "root") {
      dispatch({ type: "project/move", projectId, folderId: null })
    } else if (target.startsWith("folder:")) {
      const folderId = target.slice("folder:".length)
      dispatch({ type: "project/move", projectId, folderId })
      dispatch({ type: "folder/toggle", folderId, collapsed: false })
    } else if (target.startsWith("project:")) {
      const before = state.projects.find((p) => p.id === target.slice("project:".length))
      if (before) {
        dispatch({ type: "project/move", projectId, folderId: before.folderId ?? null, beforeProjectId: before.id })
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <SidebarMenu>
        {state.folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            projects={state.projects.filter((p) => p.folderId === folder.id)}
            renaming={renamingFolderId === folder.id}
            onRenameDone={onRenameDone}
          />
        ))}
        {rootProjects.map((project) => (
          <ProjectItem key={project.id} project={project} />
        ))}
      </SidebarMenu>
      {/* Só aparece ao arrastar um projeto que está numa pasta. */}
      {dragging?.folderId && <RootDropZone />}
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="flex items-center gap-2 rounded-md border bg-popover px-2 py-1.5 text-[13px] shadow-md">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: dragging.color }} />
            {dragging.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: "root" })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-2 mt-1 rounded-md border border-dashed px-2 py-2 text-center text-xs text-dim",
        isOver && "border-primary bg-primary/10 text-foreground",
      )}
    >
      Soltar aqui para tirar da pasta
    </div>
  )
}

function FolderItem({
  folder,
  projects,
  renaming,
  onRenameDone,
}: {
  folder: Folder
  projects: Project[]
  renaming: boolean
  onRenameDone: () => void
}) {
  const { state, dispatch } = useWorkspace()
  const [editing, setEditing] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: `folder:${folder.id}` })
  const isRenaming = renaming || editing
  const hasActive = projects.some((p) => p.id === state.activeProjectId)
  const attention = projects.some(
    (p) => p.id !== state.activeProjectId && state.tabs.some((t) => t.projectId === p.id && t.attention),
  )
  const Icon = folder.collapsed ? FolderIcon : FolderOpen

  const finishRename = (name: string | null) => {
    setEditing(false)
    onRenameDone()
    if (name !== null) dispatch({ type: "folder/rename", folderId: folder.id, name })
  }

  return (
    <SidebarMenuItem>
      <div ref={setNodeRef} className={cn("rounded-md", isOver && "bg-primary/15 ring-1 ring-primary")}>
        {isRenaming ? (
          <RenameField
            initial={folder.name}
            icon={<Icon className="size-4 shrink-0 text-muted-foreground" />}
            onDone={finishRename}
            className="flex h-8 items-center gap-2 px-2 text-[13px]"
          />
        ) : (
          <SidebarMenuButton
            onClick={() => dispatch({ type: "folder/toggle", folderId: folder.id })}
            onDoubleClick={() => setEditing(true)}
            aria-expanded={!folder.collapsed}
            className={cn("text-[13px]", folder.collapsed && hasActive && "font-medium text-foreground")}
          >
            <ChevronRight
              className={cn("size-3.5! text-dim transition-transform", !folder.collapsed && "rotate-90")}
            />
            <Icon className="text-muted-foreground" />
            <span className="truncate">{folder.name}</span>
            {folder.collapsed && attention && (
              <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-label="tem aviso novo" />
            )}
          </SidebarMenuButton>
        )}
      </div>
      {!isRenaming && (
        <>
          {/* top explícito: o botão está dentro da área de soltar, e o seletor "peer" do shadcn não o alcança. */}
          <SidebarMenuBadge className="top-1.5 font-mono text-[11px] text-dim group-hover/menu-item:opacity-0">
            {projects.length}
          </SidebarMenuBadge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction showOnHover aria-label={`Ações da pasta ${folder.name}`}>
                <MoreHorizontal />
              </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" onCloseAutoFocus={(event) => event.preventDefault()}>
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil />
                Renomear
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => dispatch({ type: "folder/remove", folderId: folder.id })}
              >
                <Trash2 />
                Remover pasta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      {!folder.collapsed && (
        <SidebarMenu className="mt-0.5 border-l border-sidebar-border pl-2 ml-3.5">
          {projects.length === 0 ? (
            <p className="px-2 py-1 text-xs text-dim">Arraste projetos para cá</p>
          ) : (
            projects.map((project) => <ProjectItem key={project.id} project={project} />)
          )}
        </SidebarMenu>
      )}
    </SidebarMenuItem>
  )
}

function ProjectItem({ project }: { project: Project }) {
  const { state, dispatch } = useWorkspace()
  const draggable = useDraggable({ id: `project:${project.id}` })
  const droppable = useDroppable({ id: `project:${project.id}` })
  const projectTabs = state.tabs.filter((t) => t.projectId === project.id)
  const attention = project.id !== state.activeProjectId && projectTabs.some((t) => t.attention)

  return (
    <SidebarMenuItem
      ref={(node) => {
        draggable.setNodeRef(node)
        droppable.setNodeRef(node)
      }}
      className={cn(
        draggable.isDragging && "opacity-40",
        // Linha acima do projeto: é ali que o arrastado vai entrar.
        droppable.isOver && !draggable.isDragging && "shadow-[inset_0_2px_0_0_var(--primary)]",
      )}
    >
      <SidebarMenuButton
        isActive={project.id === state.activeProjectId}
        onClick={() => dispatch({ type: "project/select", projectId: project.id })}
        tooltip={project.path}
        className="text-[13px]"
        {...draggable.attributes}
        {...draggable.listeners}
      >
        <span className="size-2 shrink-0 rounded-[2px]" style={{ background: project.color }} />
        <span className="truncate">{project.name}</span>
        {attention && <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-label="tem aviso novo" />}
      </SidebarMenuButton>
      <SidebarMenuBadge className="font-mono text-[11px] text-dim group-hover/menu-item:opacity-0">
        {projectTabs.length}
      </SidebarMenuBadge>
      <ProjectMenu project={project} />
    </SidebarMenuItem>
  )
}

function ProjectMenu({ project }: { project: Project }) {
  const { state, dispatch } = useWorkspace()
  return (
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
        {project.folderId && (
          <DropdownMenuItem onSelect={() => dispatch({ type: "project/move", projectId: project.id, folderId: null })}>
            <FolderIcon />
            Tirar da pasta
          </DropdownMenuItem>
        )}
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
  )
}
