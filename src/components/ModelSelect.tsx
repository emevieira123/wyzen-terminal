import { Sparkles } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getModel, modelsFor, PROVIDERS } from "@/lib/agents"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/state/workspace-context"

interface ModelSelectProps {
  value: string
  onChange: (modelId: string) => void
  className?: string
}

export function ModelSelect({ value, onChange, className }: ModelSelectProps) {
  const { state } = useWorkspace()

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        aria-label="Modelo"
        className={cn("border-none bg-transparent! px-0 text-[13px] shadow-none", className)}
      >
        <Sparkles className="text-ai" />
        {/* Só o nome no gatilho; a descrição aparece apenas na lista. */}
        <SelectValue>{getModel(value).name}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="max-h-96 w-72">
        {PROVIDERS.map((provider) => (
          <SelectGroup key={provider.id}>
            <SelectLabel>{provider.name}</SelectLabel>
            {modelsFor(provider.id, state.settings.discoveredModels[provider.id]).map((model) => (
              <SelectItem key={model.id} value={model.id} textValue={model.name}>
                <div className="flex flex-col">
                  <span>{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
