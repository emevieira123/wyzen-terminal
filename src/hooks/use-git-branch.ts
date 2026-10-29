import { useEffect, useState } from "react"

import { gitBranch } from "@/lib/pty"

/** Branch git de `cwd`, revalidada quando a janela volta ao foco. */
export function useGitBranch(cwd: string | undefined): string | null {
  const [branch, setBranch] = useState<string | null>(null)

  useEffect(() => {
    if (!cwd) {
      setBranch(null)
      return
    }
    let cancelled = false
    const refresh = () => {
      gitBranch(cwd)
        .then((b) => !cancelled && setBranch(b))
        .catch(() => !cancelled && setBranch(null))
    }
    refresh()
    window.addEventListener("focus", refresh)
    return () => {
      cancelled = true
      window.removeEventListener("focus", refresh)
    }
  }, [cwd])

  return branch
}
