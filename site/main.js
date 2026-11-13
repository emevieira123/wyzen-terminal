// Liga os botões de download aos instaladores do último release publicado.
// Sem rede ou sem a API do GitHub, os links continuam apontando para a página
// de releases, então a página nunca fica sem download.

const REPO = "emevieira123/wyzen-terminal"

// Padrões dos nomes que o tauri-action gera (ex.: Wyzen.Terminal_0.5.0_aarch64.dmg).
const INSTALLERS = [
  { id: "mac-arm", platform: "mac", label: "Apple Silicon (.dmg)", match: /_aarch64\.dmg$/ },
  { id: "mac-intel", platform: "mac", label: "Intel (.dmg)", match: /_x64\.dmg$/ },
  { id: "win-exe", platform: "windows", label: "Instalador (.exe)", match: /_x64-setup\.exe$/ },
  { id: "win-msi", platform: "windows", label: ".msi", match: /_x64_[\w-]+\.msi$/ },
  { id: "linux-appimage", platform: "linux", label: "AppImage", match: /_amd64\.AppImage$/ },
  { id: "linux-deb", platform: "linux", label: ".deb", match: /_amd64\.deb$/ },
  { id: "linux-rpm", platform: "linux", label: ".rpm", match: /\.x86_64\.rpm$/ },
]

const PRIMARY_LABEL = {
  "mac-arm": "Baixar para macOS (Apple Silicon)",
  "mac-intel": "Baixar para macOS (Intel)",
  "win-exe": "Baixar para Windows",
  "linux-appimage": "Baixar para Linux (AppImage)",
}

async function detectInstaller() {
  const ua = navigator.userAgent
  if (/Windows/.test(ua)) return "win-exe"
  if (/Linux/.test(ua) && !/Android/.test(ua)) return "linux-appimage"
  if (/Mac/.test(ua)) {
    // Só navegadores Chromium informam a arquitetura; nos outros, Apple Silicon é o caso mais comum hoje.
    try {
      const data = await navigator.userAgentData?.getHighEntropyValues(["architecture"])
      if (data?.architecture === "x86") return "mac-intel"
    } catch {
      // Sem a informação: segue com o padrão.
    }
    return "mac-arm"
  }
  return null
}

async function main() {
  let release
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!response.ok) return
    release = await response.json()
  } catch {
    return
  }

  const assets = INSTALLERS.map((installer) => ({
    ...installer,
    asset: release.assets.find((a) => installer.match.test(a.name)),
  })).filter((i) => i.asset)

  for (const container of document.querySelectorAll(".downloads")) {
    for (const installer of assets.filter((i) => i.platform === container.dataset.platform)) {
      const link = document.createElement("a")
      link.href = installer.asset.browser_download_url
      link.textContent = installer.label
      container.append(link)
    }
  }

  const version = release.tag_name.replace(/^v/, "")
  const published = new Date(release.published_at).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  document.getElementById("release-info").textContent = `Versão ${version}, publicada em ${published}. macOS, Windows e Linux.`

  const detectedId = await detectInstaller()
  const detected = assets.find((i) => i.id === detectedId)
  if (detected) {
    const button = document.getElementById("download")
    button.href = detected.asset.browser_download_url
    button.textContent = PRIMARY_LABEL[detected.id]
  }
}

main()
