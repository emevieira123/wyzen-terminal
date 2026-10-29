import { ChevronRight, LayoutGrid, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Tab } from "@/state/types"

export function PaneIcon({ kind, className }: { kind: Tab["kind"]; className?: string }) {
  if (kind === "agent") return <Sparkles className={cn("size-3 text-ai", className)} />
  if (kind === "grid") return <LayoutGrid className={cn("size-3 text-muted-foreground", className)} />
  return <ChevronRight className={cn("size-3.5 text-success", className)} strokeWidth={2.5} />
}
