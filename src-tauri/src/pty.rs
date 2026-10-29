//! Gerenciamento de sessões PTY nativas com `portable-pty`.
//!
//! Cada sessão vive em um `HashMap` compartilhado, indexada por um `sessionId`
//! (UUID v4). A saída do shell é lida em uma thread dedicada e enviada ao
//! frontend pelo evento `pty-output-{sessionId}`. Quando o processo termina,
//! o evento `pty-exit-{sessionId}` é emitido.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};
use tauri::{AppHandle, Emitter, Manager, Runtime};

const READ_BUFFER_SIZE: usize = 16 * 1024;

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    /// PID do shell, para consultar diretório atual e processos filhos.
    pid: Option<u32>,
    /// Libera a thread de leitura. Fica `Some` até o frontend chamar `attach`.
    attach: Option<Sender<()>>,
}

impl PtySession {
    fn terminate(mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Default, Clone)]
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn create<R: Runtime>(&self, app: &AppHandle<R>, cwd: &str, cols: u16, rows: u16) -> Result<String, String> {
        let size = PtySize { rows, cols, pixel_width: 0, pixel_height: 0 };
        let pair = native_pty_system().openpty(size).map_err(|e| e.to_string())?;

        let mut cmd = shell_command();
        cmd.cwd(resolve_cwd(cwd));
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("TERM_PROGRAM", "WyzenTerminal");
        // Apps GUI no macOS não herdam LANG; sem ele o zsh quebra acentos.
        if std::env::var_os("LANG").is_none() {
            cmd.env("LANG", "en_US.UTF-8");
        }

        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        let pid = child.process_id();
        // O slave precisa ser liberado para o EOF chegar quando o shell sair.
        drop(pair.slave);

        let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        let session_id = uuid::Uuid::new_v4().to_string();
        let (attach_tx, attach_rx) = mpsc::channel();

        spawn_reader(app.clone(), session_id.clone(), reader, attach_rx);

        self.lock().insert(
            session_id.clone(),
            PtySession { master: pair.master, writer, child, pid, attach: Some(attach_tx) },
        );

        Ok(session_id)
    }

    /// Começa a transmitir a saída. O frontend chama isto depois de registrar o
    /// listener do evento, então o prompt inicial do shell não se perde.
    pub fn attach(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.lock();
        let session = sessions.get_mut(session_id).ok_or_else(|| not_found(session_id))?;
        if let Some(tx) = session.attach.take() {
            let _ = tx.send(());
        }
        Ok(())
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let mut sessions = self.lock();
        let session = sessions.get_mut(session_id).ok_or_else(|| not_found(session_id))?;
        session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        if cols == 0 || rows == 0 {
            return Ok(());
        }
        let sessions = self.lock();
        let session = sessions.get(session_id).ok_or_else(|| not_found(session_id))?;
        session
            .master
            .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| e.to_string())
    }

    pub fn close(&self, session_id: &str) -> Result<(), String> {
        let session = self.lock().remove(session_id);
        if let Some(session) = session {
            session.terminate();
        }
        Ok(())
    }

    /// PID do shell de cada sessão viva.
    pub fn shell_pids(&self) -> Vec<(String, u32)> {
        self.lock()
            .iter()
            .filter_map(|(id, session)| session.pid.map(|pid| (id.clone(), pid)))
            .collect()
    }

    pub fn close_all(&self) {
        let sessions: Vec<PtySession> = self.lock().drain().map(|(_, s)| s).collect();
        for session in sessions {
            session.terminate();
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, PtySession>> {
        // Um panic com o lock na mão não deixa o mapa inconsistente; seguimos com ele.
        self.sessions.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn spawn_reader<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    mut reader: Box<dyn Read + Send>,
    attach_rx: Receiver<()>,
) {
    thread::spawn(move || {
        // Se a sessão for fechada antes do attach, o sender cai e saímos.
        if attach_rx.recv().is_err() {
            return;
        }

        let output_event = format!("pty-output-{session_id}");
        let mut buf = [0u8; READ_BUFFER_SIZE];
        let mut pending: Vec<u8> = Vec::new();

        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    if let Some(text) = take_utf8(&mut pending) {
                        let _ = app.emit(&output_event, text);
                    }
                }
            }
        }

        if !pending.is_empty() {
            let _ = app.emit(&output_event, String::from_utf8_lossy(&pending).into_owned());
        }

        // Reaproveita o close para matar/esperar o processo e evitar zumbi.
        let _ = app.state::<PtyManager>().close(&session_id);
        let _ = app.emit(&format!("pty-exit-{session_id}"), ());
    });
}

/// Extrai o maior prefixo UTF-8 válido de `pending`, mantendo no buffer um
/// caractere multibyte que tenha chegado cortado entre duas leituras.
fn take_utf8(pending: &mut Vec<u8>) -> Option<String> {
    match std::str::from_utf8(pending) {
        Ok(text) => {
            let text = text.to_owned();
            pending.clear();
            Some(text)
        }
        // Sequência incompleta no fim: emite só a parte válida.
        Err(e) if e.error_len().is_none() => {
            let valid = e.valid_up_to();
            if valid == 0 {
                return None;
            }
            let text = String::from_utf8_lossy(&pending[..valid]).into_owned();
            pending.drain(..valid);
            Some(text)
        }
        // Bytes realmente inválidos: substitui e segue.
        Err(_) => {
            let text = String::from_utf8_lossy(pending).into_owned();
            pending.clear();
            Some(text)
        }
    }
}

#[cfg(windows)]
fn shell_command() -> CommandBuilder {
    CommandBuilder::new("powershell.exe")
}

#[cfg(not(windows))]
fn shell_command() -> CommandBuilder {
    // Usa o $SHELL do usuário como login shell (zsh/bash), carregando o PATH do perfil.
    CommandBuilder::new_default_prog()
}

pub fn default_shell_name() -> String {
    if cfg!(windows) {
        return "powershell".into();
    }
    std::env::var("SHELL")
        .ok()
        .and_then(|s| s.rsplit('/').next().map(str::to_owned))
        .unwrap_or_else(|| "sh".into())
}

/// Expande `~` e cai para o diretório home quando o caminho não existe.
pub fn resolve_cwd(cwd: &str) -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
    let path = match cwd.strip_prefix('~') {
        Some(rest) => home.join(rest.trim_start_matches(['/', '\\'])),
        None if cwd.is_empty() => home.clone(),
        None => PathBuf::from(cwd),
    };
    if path.is_dir() { path } else { home }
}

fn not_found(session_id: &str) -> String {
    format!("sessão PTY não encontrada: {session_id}")
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc;
    use std::time::{Duration, Instant};

    use tauri::{Listener, Manager};

    use super::{PtyManager, take_utf8};

    #[test]
    fn runs_command_in_real_shell_and_streams_output() {
        let app = tauri::test::mock_app();
        let manager = PtyManager::default();
        app.manage(manager.clone());
        let handle = app.handle().clone();

        let cwd = std::env::temp_dir();
        let id = manager.create(&handle, cwd.to_str().unwrap(), 80, 24).unwrap();

        let (tx, rx) = mpsc::channel::<String>();
        handle.listen(format!("pty-output-{id}"), move |event| {
            let _ = tx.send(event.payload().to_owned());
        });
        manager.attach(&id).unwrap();
        // A conta só sai certa se o shell executou, não se só ecoou a digitação.
        manager.write(&id, "echo wyzen-$((40+2))\r").unwrap();
        manager.resize(&id, 120, 40).unwrap();

        let deadline = Instant::now() + Duration::from_secs(15);
        let mut output = String::new();
        while !output.contains("wyzen-42") {
            let left = deadline.saturating_duration_since(Instant::now());
            match rx.recv_timeout(left) {
                Ok(chunk) => output.push_str(&chunk),
                Err(_) => panic!("shell não respondeu; saída até aqui: {output}"),
            }
        }

        manager.close(&id).unwrap();
        assert!(manager.write(&id, "x").is_err(), "sessão deveria ter sido removida");
    }

    #[test]
    fn keeps_split_multibyte_char_for_next_read() {
        // "ção" = c3 a7 c3 a3 6f; cortamos no meio do segundo caractere.
        let mut pending = vec![0xc3, 0xa7, 0xc3];
        assert_eq!(take_utf8(&mut pending).as_deref(), Some("ç"));
        assert_eq!(pending, vec![0xc3]);

        pending.extend_from_slice(&[0xa3, 0x6f]);
        assert_eq!(take_utf8(&mut pending).as_deref(), Some("ão"));
        assert!(pending.is_empty());
    }

    #[test]
    fn waits_when_only_partial_char_is_buffered() {
        let mut pending = vec![0xe2, 0x9d];
        assert_eq!(take_utf8(&mut pending), None);
        assert_eq!(pending.len(), 2);
    }
}
