import { Combine, LayoutGrid, Plus, X } from "lucide-react"

import { PaneIcon } from "@/components/PaneIcon"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isMac, shortcutLabel } from "@/lib/platform"
import { cn } from "@/lib/utils"
import { GRID_LIMIT } from "@/state/types"
import { useWorkspace } from "@/state/workspace-context"

export function TitleBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { state, dispatch } = useWorkspace()
  const tabs = state.tabs.filter((t) => t.projectId === state.activeProjectId)
  const activeTabId = state.activeTabByProject[state.activeProjectId] ?? ""
  const canGroup = tabs.filter((t) => t.kind !== "grid").length >= 2

  return (
    <header
      data-tauri-drag-region
      className={cn(
        "relative z-20 flex h-11 shrink-0 items-center gap-3 border-b bg-chrome pr-3.5",
        // Espaço para os semáforos nativos (titleBarStyle: Overlay).
        isMac ? "pl-[84px]" : "pl-2",
      )}
    >
      <SidebarTrigger className="text-dim hover:text-foreground" />

      <Tabs
        value={activeTabId}
        onValueChange={(tabId) => dispatch({ type: "tab/select", tabId })}
        className="h-full min-w-0 self-end"
      >
        <TabsList variant="line" className="h-full items-end gap-0.5 overflow-x-auto p-0">
          {tabs.map((tab) => (
            <div key={tab.id} className="group/tab relative flex h-[34px] items-stretch">
              <TabsTrigger
                value={tab.id}
                className={cn(
                  "h-full flex-none gap-2 rounded-t-lg rounded-b-none border border-transparent pr-8 pl-3 text-[12.5px] font-normal",
                  "after:hidden data-[state=active]:border-border data-[state=active]:border-b-background",
                  "data-[state=active]:bg-background! data-[state=active]:text-foreground",
                  "-mb-px",
                )}
              >
                <PaneIcon kind={tab.kind} />
                {tab.title}
              </TabsTrigger>
              <button
                type="button"
                aria-label={`Fechar ${tab.title}`}
                onClick={() => dispatch({ type: "tab/close", tabId: tab.id })}
                className="absolute top-1/2 right-2 grid size-4 -translate-y-1/2 place-items-center rounded text-dim hover:bg-border hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </TabsList>
      </Tabs>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="text-dim" aria-label="Nova sessão">
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-60"
          // Sem isto o foco volta ao "+" e rouba o foco da aba recém-criada.
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuItem onSelect={() => dispatch({ type: "tab/new", kind: "terminal" })}>
            <PaneIcon kind="terminal" />
            Novo terminal
            <DropdownMenuShortcut>{shortcutLabel("T")}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => dispatch({ type: "tab/new", kind: "agent" })}>
            <PaneIcon kind="agent" />
            Novo agente
            <DropdownMenuShortcut>{shortcutLabel("A", { shift: true })}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => dispatch({ type: "tab/newGrid" })}>
            <LayoutGrid />
            Novo grid
            <DropdownMenuShortcut>até {GRID_LIMIT} painéis</DropdownMenuShortcut>
          </DropdownMenuItem>
          {canGroup && (
            <DropdownMenuItem onSelect={() => dispatch({ type: "tab/groupIntoGrid" })}>
              <Combine />
              Agrupar abas em grid
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div data-tauri-drag-region className="h-full flex-1" />

      <button
        type="button"
        onClick={onOpenPalette}
        className="flex items-center gap-2 rounded-md border bg-panel px-2.5 py-1 text-xs text-muted-foreground hover:border-input"
      >
        <Kbd>{shortcutLabel("K")}</Kbd>
        Buscar comandos, workflows, IA…
      </button>
    </header>
  )
}
