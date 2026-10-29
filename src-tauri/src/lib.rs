mod process;
mod pty;
mod secrets;

use std::process::Command;

use pty::PtyManager;
use tauri::{AppHandle, Manager, RunEvent, State};

const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;

/// Abre um shell no diretório `cwd` e devolve o `sessionId`.
/// A saída só começa a fluir depois de `attach_pty_session`.
#[tauri::command]
async fn create_pty_session(
    app: AppHandle,
    state: State<'_, PtyManager>,
    cwd: String,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<String, String> {
    state.create(&app, &cwd, cols.unwrap_or(DEFAULT_COLS), rows.unwrap_or(DEFAULT_ROWS))
}

#[tauri::command]
fn attach_pty_session(state: State<'_, PtyManager>, session_id: String) -> Result<(), String> {
    state.attach(&session_id)
}

#[tauri::command]
fn write_to_pty(state: State<'_, PtyManager>, session_id: String, data: String) -> Result<(), String> {
    state.write(&session_id, &data)
}

#[tauri::command]
fn resize_pty(
    state: State<'_, PtyManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&session_id, cols, rows)
}

#[tauri::command]
fn close_pty_session(state: State<'_, PtyManager>, session_id: String) -> Result<(), String> {
    state.close(&session_id)
}

/// Diretório atual e programa em execução de cada terminal.
#[tauri::command]
async fn pty_status(state: State<'_, PtyManager>) -> Result<Vec<process::SessionStatus>, String> {
    Ok(process::status(state.shell_pids()))
}

#[tauri::command]
fn default_shell() -> String {
    pty::default_shell_name()
}

/// Branch atual do repositório em `cwd`, ou `None` fora de um repositório git.
#[tauri::command]
async fn git_branch(cwd: String) -> Option<String> {
    let mut cmd = Command::new("git");
    cmd.args(["rev-parse", "--abbrev-ref", "HEAD"]).current_dir(pty::resolve_cwd(&cwd));
    // Sem esta flag o Windows abre um console por um instante a cada consulta.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let branch = String::from_utf8(output.stdout).ok()?.trim().to_owned();
    (!branch.is_empty()).then_some(branch)
}

// Comandos `async` rodam fora da thread principal; o Keychain pode pedir
// autorização ao usuário e não deve travar a interface.
#[tauri::command]
async fn get_api_key(provider: String) -> Result<Option<String>, String> {
    secrets::get(&provider)
}

#[tauri::command]
async fn api_key_status(provider: String) -> Result<secrets::ApiKeyStatus, String> {
    secrets::status(&provider)
}

#[tauri::command]
async fn set_api_key(provider: String, key: String) -> Result<(), String> {
    secrets::set(&provider, &key)
}

#[tauri::command]
async fn delete_api_key(provider: String) -> Result<(), String> {
    secrets::delete(&provider)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .manage(PtyManager::default())
        .invoke_handler(tauri::generate_handler![
            create_pty_session,
            attach_pty_session,
            write_to_pty,
            resize_pty,
            close_pty_session,
            pty_status,
            default_shell,
            git_branch,
            get_api_key,
            api_key_status,
            set_api_key,
            delete_api_key,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                app.state::<PtyManager>().close_all();
            }
        });
}
