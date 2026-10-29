//! Informações dos processos dos terminais: diretório atual do shell (para a
//! sessão reabrir no mesmo lugar) e o programa rodando nele (para avisar antes
//! de reiniciar). Usa `ps`/`lsof` no macOS e `/proc` no Linux; no Windows não
//! há equivalente simples, e as consultas devolvem vazio.

use std::collections::HashMap;
use std::process::Command;

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatus {
    pub session_id: String,
    /// Diretório atual do shell.
    pub cwd: Option<String>,
    /// Programa rodando dentro do shell (filho direto), se houver.
    pub running: Option<String>,
}

pub fn status(shells: Vec<(String, u32)>) -> Vec<SessionStatus> {
    let pids: Vec<u32> = shells.iter().map(|(_, pid)| *pid).collect();
    let children = child_commands(&pids);
    let cwds = cwds(&pids);
    shells
        .into_iter()
        .map(|(session_id, pid)| SessionStatus {
            session_id,
            cwd: cwds.get(&pid).cloned(),
            running: children.get(&pid).cloned(),
        })
        .collect()
}

/// Primeiro filho de cada shell, pelo nome do executável.
#[cfg(unix)]
fn child_commands(shells: &[u32]) -> HashMap<u32, String> {
    let Some(out) = run("ps", &["-A", "-o", "pid=,ppid=,comm="]) else {
        return HashMap::new();
    };
    let mut found = HashMap::new();
    for line in out.lines() {
        let mut parts = line.split_whitespace();
        let (Some(_pid), Some(ppid), Some(comm)) = (parts.next(), parts.next(), parts.next()) else {
            continue;
        };
        let Ok(ppid) = ppid.parse::<u32>() else { continue };
        if shells.contains(&ppid) {
            let name = comm.rsplit('/').next().unwrap_or(comm).trim_start_matches('-');
            found.entry(ppid).or_insert_with(|| name.to_owned());
        }
    }
    found
}

#[cfg(target_os = "macos")]
fn cwds(pids: &[u32]) -> HashMap<u32, String> {
    if pids.is_empty() {
        return HashMap::new();
    }
    let list = pids.iter().map(u32::to_string).collect::<Vec<_>>().join(",");
    // -Fpn: uma linha "p<pid>" seguida de "n<caminho>" para cada processo.
    let Some(out) = run("lsof", &["-a", "-d", "cwd", "-Fpn", "-p", &list]) else {
        return HashMap::new();
    };
    let mut result = HashMap::new();
    let mut current = None;
    for line in out.lines() {
        if let Some(pid) = line.strip_prefix('p') {
            current = pid.parse::<u32>().ok();
        } else if let (Some(path), Some(pid)) = (line.strip_prefix('n'), current) {
            result.insert(pid, path.to_owned());
        }
    }
    result
}

#[cfg(all(unix, not(target_os = "macos")))]
fn cwds(pids: &[u32]) -> HashMap<u32, String> {
    pids.iter()
        .filter_map(|pid| {
            let path = std::fs::read_link(format!("/proc/{pid}/cwd")).ok()?;
            Some((*pid, path.to_string_lossy().into_owned()))
        })
        .collect()
}

#[cfg(windows)]
fn child_commands(_shells: &[u32]) -> HashMap<u32, String> {
    HashMap::new()
}

#[cfg(windows)]
fn cwds(_pids: &[u32]) -> HashMap<u32, String> {
    HashMap::new()
}

#[cfg(unix)]
fn run(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    // lsof sai com 1 quando algum pid some no meio; a saída parcial ainda serve.
    String::from_utf8(output.stdout).ok()
}

#[cfg(all(test, unix))]
mod tests {
    use super::status;

    #[test]
    fn reports_cwd_and_child_of_a_shell() {
        let dir = std::env::temp_dir().canonicalize().unwrap();
        let mut shell = std::process::Command::new("sh")
            // O "; true" impede o sh de virar o próprio sleep (exec): ele precisa criar um filho.
            .args(["-c", "sleep 5; true"])
            .current_dir(&dir)
            .spawn()
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(200));

        let report = status(vec![("s".into(), shell.id())]);
        let _ = shell.kill();
        let _ = shell.wait();

        let s = &report[0];
        assert_eq!(s.cwd.as_deref().map(std::path::Path::new), Some(dir.as_path()));
        assert_eq!(s.running.as_deref(), Some("sleep"));
    }
}
