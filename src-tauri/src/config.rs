use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server: String,
    pub domain: String,
    pub username: String,
    pub password: String,
}

impl AppConfig {
    /// Auto-derive Base DN from domain: "company.com" -> "DC=company,DC=com"
    pub fn base_dn(&self) -> String {
        self.domain
            .split('.')
            .filter(|s| !s.is_empty())
            .map(|part| format!("DC={}", part))
            .collect::<Vec<_>>()
            .join(",")
    }

    /// Auto-derive Bind DN: "admin" + base_dn -> "CN=admin,DC=company,DC=com"
    pub fn bind_dn(&self) -> String {
        if self.username.contains('=') {
            // User provided full DN
            self.username.clone()
        } else {
            format!("CN={},{}", self.username, self.base_dn())
        }
    }

    /// LDAP URL with SSL
    pub fn ldap_url(&self) -> String {
        format!("ldaps://{}:636", self.server)
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: String::new(),
            domain: String::new(),
            username: String::new(),
            password: String::new(),
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
