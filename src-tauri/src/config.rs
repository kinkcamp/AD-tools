use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub ldap_host: String,
    pub ldap_port: u16,
    pub base_dn: String,
    pub bind_dn: String,
    pub bind_password: String,
    pub ssl_enabled: bool,
    pub start_tls: bool,
    pub verify_cert: bool,
    pub ca_cert_path: String,
    pub ldap_version: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            ldap_host: "ldap://dc01.company.com".to_string(),
            ldap_port: 636,
            base_dn: "DC=company,DC=com".to_string(),
            bind_dn: String::new(),
            bind_password: String::new(),
            ssl_enabled: true,
            start_tls: false,
            verify_cert: true,
            ca_cert_path: String::new(),
            ldap_version: "3".to_string(),
        }
    }
}

fn config_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("ad-assistant");
    fs::create_dir_all(&path).ok();
    path.push("config.json");
    path
}

pub fn load_config() -> Result<AppConfig, String> {
    let path = config_path();
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("读取配置失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析配置失败: {}", e))
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    let content = serde_json::to_string_pretty(config).map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("保存配置失败: {}", e))
}
