import { useCallback, useEffect, useState, type CSSProperties } from "react"

import { CommandPalette } from "@/components/dialogs/CommandPalette"
import { ProjectDialog } from "@/components/dialogs/ProjectDialog"
import { SettingsDialog } from "@/components/dialogs/SettingsDialog"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { StatusBar } from "@/components/layout/StatusBar"
import { TitleBar } from "@/components/layout/TitleBar"
import { MainView } from "@/components/MainView"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { pickDirectory } from "@/lib/pick-directory"
import { isModKey } from "@/lib/platform"
import { focusedPane } from "@/state/workspace-reducer"
import { useWorkspace, WorkspaceProvider } from "@/state/workspace-context"

export default function App() {
  return (
    <WorkspaceProvider>
      <TooltipProvider delayDuration={400}>
        <Shell />
      </TooltipProvider>
    </WorkspaceProvider>
  )
}

type Overlay = "palette" | "settings" | "project" | null

function Shell() {
  const { state, dispatch, changeDirectory } = useWorkspace()
  const [overlay, setOverlay] = useState<Overlay>(null)
  const setOpen = (name: Exclude<Overlay, null>) => (open: boolean) => setOverlay(open ? name : null)

  const promptChangeDirectory = useCallback(async () => {
    const dir = await pickDirectory(focusedPane(state)?.cwd)
    if (dir) changeDirectory(dir)
  }, [state, changeDirectory])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isModKey(event)) return
      switch (event.key.toLowerCase()) {
        case "t":
          dispatch({ type: "tab/new", kind: "terminal" })
          break
        case "a":
          if (!event.shiftKey) return
          dispatch({ type: "tab/new", kind: "agent" })
          break
        case "k":
          setOverlay((o) => (o === "palette" ? null : "palette"))
          break
        case ",":
          setOverlay("settings")
          break
        default:
          return
      }
      event.preventDefault()
      event.stopPropagation()
    }
    // Fase de captura: o xterm consumiria a tecla antes do listener comum.
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [dispatch])

  return (
    <SidebarProvider
      className="h-svh min-h-0 flex-col overflow-hidden"
      style={{ "--sidebar-width": "15rem" } as CSSProperties}
    >
      <TitleBar onOpenPalette={() => setOverlay("palette")} />
      <div className="flex min-h-0 flex-1">
        <AppSidebar onAddProject={() => setOverlay("project")} onOpenSettings={() => setOverlay("settings")} />
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
          <MainView />
        </SidebarInset>
      </div>
      <StatusBar onChangeDirectory={promptChangeDirectory} />

      <CommandPalette
        open={overlay === "palette"}
        onOpenChange={setOpen("palette")}
        onOpenSettings={() => setOverlay("settings")}
        onChangeDirectory={promptChangeDirectory}
      />
      <SettingsDialog open={overlay === "settings"} onOpenChange={setOpen("settings")} />
      <ProjectDialog open={overlay === "project"} onOpenChange={setOpen("project")} />
    </SidebarProvider>
  )
}
