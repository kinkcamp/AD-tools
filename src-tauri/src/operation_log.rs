use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

const MAX_LOG_ENTRIES: usize = 5000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub time: String,
    pub operation: String,
    pub target: String,
    pub operator: String,
    pub status: String, // success | failed | partial
    pub detail: String,
}

fn log_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("ad-assistant");
    fs::create_dir_all(&path).ok();
    path.push("operations.log.jsonl");
    path
}

/// 追加一条审计日志（JSON Lines 格式，落盘失败不阻断业务）
pub fn append(entry: LogEntry) {
    let path = log_path();
    let line = match serde_json::to_string(&entry) {
        Ok(l) => l,
        Err(_) => return,
    };
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "{}", line);
    }
    // 超过上限时截断保留最近记录
    if let Ok(content) = fs::read_to_string(&path) {
        let lines: Vec<&str> = content.lines().collect();
        if lines.len() > MAX_LOG_ENTRIES {
            let kept = lines[lines.len() - MAX_LOG_ENTRIES..].join("\n");
            let _ = fs::write(&path, kept + "\n");
        }
    }
}

/// 记录一次批量操作的审计日志
pub fn append_batch(operation: &str, operator: &str, total: usize, success: usize) {
    let status = if success == total {
        "success"
    } else if success == 0 {
        "failed"
    } else {
        "partial"
    };
    append(LogEntry {
        time: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        operation: operation.to_string(),
        target: format!("共 {} 个对象", total),
        operator: operator.to_string(),
        status: status.to_string(),
        detail: format!("成功 {} · 失败 {}", success, total - success),
    });
}

/// 读取审计日志（倒序，最新在前）
pub fn list(limit: usize) -> Vec<LogEntry> {
    let path = log_path();
    let f = match fs::File::open(&path) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    let reader = BufReader::new(f);
    let mut entries: Vec<LogEntry> = reader
        .lines()
        .filter_map(|l| l.ok())
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str::<LogEntry>(&l).ok())
        .collect();
    entries.reverse();
    entries.truncate(limit);
    entries
}
