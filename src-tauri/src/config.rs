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

    /// 绑定身份：优先 UPN 格式（user@domain），AD 支持 UPN 绑定且与用户所在 OU 无关；
    /// 用户也可直接填写完整 DN
    pub fn bind_dn(&self) -> String {
        if self.username.contains('=') || self.username.contains('@') {
            // 用户提供了完整 DN 或 UPN
            self.username.clone()
        } else {
            format!("{}@{}", self.username, self.domain)
        }
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
    fs::write(&path, content).map_err(|e| format!("保存配置失败: {}", e))?;
    // 限制配置文件权限为仅当前用户可读写（含绑定密码）
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("设置文件权限失败: {}", e))?;
    }
    Ok(())
}
