import { useEffect, useRef } from "react"
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification"
import { toast } from "sonner"

import { playChime, setTerminalAlertHandler, type TerminalAlert } from "@/lib/terminal-alerts"
import type { WorkspaceState } from "@/state/types"
import type { WorkspaceAction } from "@/state/workspace-reducer"

async function notifySystem(title: string, body: string) {
  let granted = await isPermissionGranted()
  if (!granted) granted = (await requestPermission()) === "granted"
  if (granted) sendNotification({ title, body })
}

/**
 * Exibe os avisos que chegam dos terminais (ex.: Claude Code terminou ou pede
 * aprovação). Se o usuário já está olhando para aquele terminal, não faz nada.
 */
export function useTerminalAlerts(state: WorkspaceState, dispatch: (action: WorkspaceAction) => void) {
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    setTerminalAlertHandler((paneId: string, alert: TerminalAlert) => {
      const current = stateRef.current
      const tab = current.tabs.find((t) => t.paneIds.includes(paneId))
      const pane = current.panes[paneId]
      if (!tab || !pane) return

      const windowFocused = document.hasFocus()
      const tabVisible =
        current.activeProjectId === tab.projectId && current.activeTabByProject[tab.projectId] === tab.id
      if (windowFocused && tabVisible) return

      const project = current.projects.find((p) => p.id === tab.projectId)
      const place = tab.kind === "grid" ? `${tab.title} › ${pane.title}` : tab.title
      const origin = project && project.id !== current.activeProjectId ? `${project.name} / ${place}` : place
      const title = alert.title ?? origin
      const body = alert.title ? `${origin}: ${alert.body}` : alert.body

      if (!tabVisible) dispatch({ type: "tab/attention", paneId })

      toast(title, {
        description: body,
        duration: 8_000,
        action: {
          label: "Ver",
          onClick: () => {
            dispatch({ type: "tab/select", tabId: tab.id })
            dispatch({ type: "pane/focus", tabId: tab.id, paneId })
          },
        },
      })
      if (current.settings.alertSound) playChime()
      if (!windowFocused && current.settings.alertSystem) void notifySystem(title, body).catch(() => undefined)
    })
    return () => setTerminalAlertHandler(null)
  }, [dispatch])
}
