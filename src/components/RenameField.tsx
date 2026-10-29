import { useEffect, useRef, useState, type ReactNode } from "react"

interface RenameFieldProps {
  initial: string
  icon?: ReactNode
  /** Novo nome, ou `null` se cancelado. */
  onDone: (title: string | null) => void
  className?: string
}

/** Campo de renomear no lugar: Enter ou sair do campo confirma, Esc cancela. */
export function RenameField({ initial, icon, onDone, className }: RenameFieldProps) {
  const [value, setValue] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  const done = useRef(false)

  const finish = (title: string | null) => {
    if (done.current) return
    done.current = true
    onDone(title)
  }

  // Adiado: um menu de contexto ainda fechando tiraria o foco.
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={className}>
      {icon}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish(value.trim() || null)
          if (e.key === "Escape") finish(null)
        }}
        onBlur={() => finish(value.trim() || null)}
        aria-label="Novo nome"
        maxLength={40}
        spellCheck={false}
        style={{ width: `${Math.max(value.length, 4) + 1}ch` }}
        className="rounded-sm bg-transparent text-foreground outline-1 outline-primary"
      />
    </div>
  )
}
