import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "@/App"
import { registerAgentProvider } from "@/lib/agents"
import { anthropicProvider } from "@/lib/providers/anthropic"
import { googleProvider } from "@/lib/providers/google"
import { openaiProvider } from "@/lib/providers/openai"
import "@/index.css"

registerAgentProvider(anthropicProvider)
registerAgentProvider(openaiProvider)
registerAgentProvider(googleProvider)

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
