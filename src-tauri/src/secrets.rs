//! Chaves de API dos provedores de IA no cofre do sistema: Keychain no macOS,
//! Credential Manager no Windows e Secret Service no Linux. Nada vai para disco
//! em texto puro nem para o localStorage do webview.

use serde::Serialize;

const SERVICE: &str = "com.wyzen.terminal";

/// Provedores aceitos e as variáveis de ambiente usadas como alternativa.
fn env_vars(provider: &str) -> Result<&'static [&'static str], String> {
    match provider {
        "anthropic" => Ok(&["ANTHROPIC_API_KEY"]),
        "openai" => Ok(&["OPENAI_API_KEY"]),
        "google" => Ok(&["GEMINI_API_KEY", "GOOGLE_API_KEY"]),
        other => Err(format!("provedor desconhecido: {other}")),
    }
}

fn env_key(provider: &str) -> Result<Option<String>, String> {
    Ok(env_vars(provider)?
        .iter()
        .find_map(|name| std::env::var(name).ok().filter(|k| !k.trim().is_empty())))
}

fn entry(provider: &str) -> Result<keyring::Entry, String> {
    env_vars(provider)?;
    keyring::Entry::new(SERVICE, provider).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyStatus {
    /// "keychain", "env" ou "none".
    source: &'static str,
    /// Últimos 4 caracteres, para o usuário reconhecer qual chave está em uso.
    hint: Option<String>,
}

fn stored_key(provider: &str) -> Result<Option<String>, String> {
    match entry(provider)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Chave do cofre; sem ela, a variável de ambiente (útil em `pnpm tauri dev`).
pub fn get(provider: &str) -> Result<Option<String>, String> {
    if let Some(key) = stored_key(provider)? {
        return Ok(Some(key));
    }
    env_key(provider)
}

pub fn status(provider: &str) -> Result<ApiKeyStatus, String> {
    let hint = |key: &str| {
        let chars: Vec<char> = key.chars().collect();
        Some(chars[chars.len().saturating_sub(4)..].iter().collect())
    };
    if let Some(key) = stored_key(provider)? {
        return Ok(ApiKeyStatus { source: "keychain", hint: hint(&key) });
    }
    Ok(match env_key(provider)? {
        Some(key) => ApiKeyStatus { source: "env", hint: hint(&key) },
        None => ApiKeyStatus { source: "none", hint: None },
    })
}

pub fn set(provider: &str, key: &str) -> Result<(), String> {
    let key = key.trim();
    if key.is_empty() {
        return Err("chave vazia".into());
    }
    entry(provider)?.set_password(key).map_err(|e| e.to_string())
}

pub fn delete(provider: &str) -> Result<(), String> {
    match entry(provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
