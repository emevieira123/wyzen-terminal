import { useState } from "react"
import { Pencil, X } from "lucide-react"

import { PaneIcon } from "@/components/PaneIcon"
import { RenameField } from "@/components/RenameField"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { Tab } from "@/state/types"
import { useWorkspace } from "@/state/workspace-context"

const tabShape = cn(
  "h-full flex-none gap-2 rounded-t-lg rounded-b-none border border-transparent pr-8 pl-3 text-[12.5px] font-normal",
  "-mb-px",
)

export function TabItem({ tab, active }: { tab: Tab; active: boolean }) {
  const { dispatch } = useWorkspace()
  const [editing, setEditing] = useState(false)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group/tab relative flex h-[34px] items-stretch">
          {editing ? (
            <RenameField
              initial={tab.title}
              icon={<PaneIcon kind={tab.kind} />}
              onDone={(title) => {
                setEditing(false)
                if (title !== null) dispatch({ type: "tab/rename", tabId: tab.id, title })
              }}
              className={cn(
                tabShape,
                "flex items-center",
                active && "border-border border-b-background bg-background text-foreground",
              )}
            />
          ) : (
            <TabsTrigger
              value={tab.id}
              onDoubleClick={() => setEditing(true)}
              title="Duplo clique ou botão direito para renomear"
              className={cn(
                tabShape,
                "after:hidden data-[state=active]:border-border data-[state=active]:border-b-background",
                "data-[state=active]:bg-background! data-[state=active]:text-foreground",
              )}
            >
              <PaneIcon kind={tab.kind} />
              {tab.title}
            </TabsTrigger>
          )}
          <button
            type="button"
            aria-label={`Fechar ${tab.title}`}
            onClick={() => dispatch({ type: "tab/close", tabId: tab.id })}
            className="absolute top-1/2 right-2 grid size-4 -translate-y-1/2 place-items-center rounded text-dim hover:bg-border hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      </ContextMenuTrigger>
      {/* Sem devolver o foco à aba: ele precisa ir para o campo de renomear. */}
      <ContextMenuContent className="w-44" onCloseAutoFocus={(event) => event.preventDefault()}>
        <ContextMenuItem onSelect={() => setEditing(true)}>
          <Pencil />
          Renomear
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={() => dispatch({ type: "tab/close", tabId: tab.id })}>
          <X />
          Fechar aba
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
