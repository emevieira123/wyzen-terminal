import { useState, type FormEvent } from "react"
import { FolderOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { pickDirectory } from "@/lib/pick-directory"
import { useWorkspace } from "@/state/workspace-context"

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProjectDialog({ open, onOpenChange }: ProjectDialogProps) {
  const { dispatch } = useWorkspace()
  const [name, setName] = useState("")
  const [path, setPath] = useState("")

  async function browse() {
    const dir = await pickDirectory(path)
    if (!dir) return
    setPath(dir)
    if (!name) setName(dir.split(/[\\/]/).filter(Boolean).pop() ?? "")
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !path.trim()) return
    dispatch({ type: "project/add", name: name.trim(), path: path.trim() })
    setName("")
    setPath("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>Terminais e agentes deste projeto abrem nesta pasta.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-path">Pasta</Label>
            <div className="flex gap-2">
              <Input
                id="project-path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="~/dev/meu-projeto"
                className="font-mono text-[12.5px]"
              />
              <Button type="button" variant="outline" onClick={browse}>
                <FolderOpen />
                Escolher
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Nome</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || !path.trim()}>
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
