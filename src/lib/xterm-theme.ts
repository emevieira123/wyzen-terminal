import type { ITheme } from "@xterm/xterm"

import type { ThemeName } from "@/state/types"

// O xterm não entende oklch nem variáveis CSS, então a paleta é repetida em hex
// a partir dos mesmos tokens do index.css.
const dark: ITheme = {
  background: "#0f1319",
  foreground: "#c9d1dc",
  cursor: "#c9d1dc",
  cursorAccent: "#0f1319",
  selectionBackground: "#2a4a7a80",
  black: "#1c222c",
  red: "#f85149",
  green: "#3fb950",
  yellow: "#e3b341",
  blue: "#58a6ff",
  magenta: "#c586c0",
  cyan: "#39c5cf",
  white: "#c9d1dc",
  brightBlack: "#5d6676",
  brightRed: "#ff7b72",
  brightGreen: "#56d364",
  brightYellow: "#f2cc60",
  brightBlue: "#79c0ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd",
  brightWhite: "#e6ebf2",
}

const light: ITheme = {
  background: "#f6f4f0",
  foreground: "#36322c",
  cursor: "#36322c",
  cursorAccent: "#f6f4f0",
  selectionBackground: "#9ec5ff80",
  black: "#23201c",
  red: "#cf222e",
  green: "#1a7f37",
  yellow: "#9a6700",
  blue: "#0969da",
  magenta: "#8250df",
  cyan: "#1b7c83",
  white: "#6b645a",
  brightBlack: "#948c80",
  brightRed: "#a40e26",
  brightGreen: "#116329",
  brightYellow: "#7d4e00",
  brightBlue: "#0550ae",
  brightMagenta: "#6639ba",
  brightCyan: "#136061",
  brightWhite: "#23201c",
}

export const xtermThemes: Record<ThemeName, ITheme> = { dark, light }
