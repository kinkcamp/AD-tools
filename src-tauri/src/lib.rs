mod config;
mod file_parser;
mod ldap_client;
mod operation_log;

use config::AppConfig;
use ldap_client::LdapClient;
use std::collections::HashMap;
#[cfg_attr(not(target_os = "windows"), allow(unused_imports))]
use tauri::{Emitter, Manager};

#[tauri::command]
fn get_config() -> Result<AppConfig, String> {
    config::load_config()
}

#[tauri::command]
fn save_config_cmd(cfg: AppConfig) -> Result<(), String> {
    config::save_config(&cfg)
}

#[tauri::command]
async fn test_connection(cfg: AppConfig) -> Result<String, String> {
    let client = LdapClient::new(cfg);
    client.test_connection().await
}

#[tauri::command]
async fn search_users(cfg: AppConfig, keyword: String) -> Result<Vec<ldap_client::ADUser>, String> {
    if keyword.trim().is_empty() {
        return Err("请输入搜索关键词".to_string());
    }
    let client = LdapClient::new(cfg);
    client.search_users(&keyword).await
}

#[tauri::command]
async fn list_users(cfg: AppConfig) -> Result<Vec<ldap_client::ADUser>, String> {
    let client = LdapClient::new(cfg);
    client.list_users().await
}

#[tauri::command]
async fn change_password(cfg: AppConfig, user_dn: String, new_password: String, force_change: bool) -> Result<(), String> {
    let operator = cfg.username.clone();
    let client = LdapClient::new(cfg);
    let result = client.change_password(&user_dn, &new_password, force_change).await;
    operation_log::append(operation_log::LogEntry {
        time: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        operation: "修改密码".to_string(),
        target: user_dn,
        operator,
        status: if result.is_ok() { "success".to_string() } else { "failed".to_string() },
        detail: result.clone().err().unwrap_or_else(|| if force_change { "已要求下次登录修改".to_string() } else { String::new() }),
    });
    result
}

#[tauri::command]
async fn delete_user(cfg: AppConfig, user_dn: String) -> Result<(), String> {
    let operator = cfg.username.clone();
    let client = LdapClient::new(cfg);
    let result = client.delete_user(&user_dn).await;
    operation_log::append(operation_log::LogEntry {
        time: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        operation: "删除用户".to_string(),
        target: user_dn,
        operator,
        status: if result.is_ok() { "success".to_string() } else { "failed".to_string() },
        detail: result.clone().err().unwrap_or_default(),
    });
    result
}

#[tauri::command]
async fn batch_create_users(app: tauri::AppHandle, cfg: AppConfig, users: Vec<ldap_client::NewUserSpec>) -> Result<ldap_client::BatchResult, String> {
    let operator = cfg.username.clone();
    let total = users.len();
    let client = LdapClient::new(cfg);
    // 每完成一步实时推送进度事件，前端逐行刷新状态
    let result = client.batch_create_users(users, |evt| {
        let _ = app.emit("batch-create-progress", &evt);
    }).await?;
    operation_log::append_batch("批量创建用户", &operator, total, result.success);
    Ok(result)
}

#[tauri::command]
async fn get_user_attributes(cfg: AppConfig) -> Result<Vec<String>, String> {
    let client = LdapClient::new(cfg);
    client.get_user_schema_attributes().await
}

#[tauri::command]
async fn batch_change_passwords(cfg: AppConfig, items: Vec<ldap_client::BatchPasswordItem>) -> Result<ldap_client::BatchResult, String> {
    let operator = cfg.username.clone();
    let total = items.len();
    let client = LdapClient::new(cfg);
    let result = client.batch_change_passwords(items).await?;
    operation_log::append_batch("批量修改密码", &operator, total, result.success);
    Ok(result)
}

#[tauri::command]
async fn batch_add_to_group(cfg: AppConfig, usernames: Vec<String>, groups: Vec<String>) -> Result<ldap_client::BatchResult, String> {
    let operator = cfg.username.clone();
    let total = usernames.len();
    let client = LdapClient::new(cfg);
    let result = client.batch_add_to_group(usernames, groups.clone()).await?;
    operation_log::append_batch(&format!("批量加入组({})", groups.join(",")), &operator, total, result.success);
    Ok(result)
}

#[tauri::command]
async fn batch_modify_attributes(
    cfg: AppConfig,
    usernames: Vec<String>,
    mods: HashMap<String, String>,
    per_user_values: HashMap<String, HashMap<String, String>>,
    append: bool,
) -> Result<ldap_client::BatchResult, String> {
    let operator = cfg.username.clone();
    let total = usernames.len();
    let client = LdapClient::new(cfg);
    let result = client.batch_modify_attributes(usernames, mods.clone(), per_user_values, append).await?;
    let attrs: Vec<&String> = mods.keys().collect();
    operation_log::append_batch(
        &format!("批量修改属性({})", attrs.iter().map(|a| a.as_str()).collect::<Vec<_>>().join(",")),
        &operator,
        total,
        result.success,
    );
    Ok(result)
}

#[tauri::command]
async fn set_account_enabled(cfg: AppConfig, user_dn: String, enable: bool) -> Result<(), String> {
    let operator = cfg.username.clone();
    let client = LdapClient::new(cfg);
    let result = client.set_account_enabled(&user_dn, enable).await;
    operation_log::append(operation_log::LogEntry {
        time: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        operation: if enable { "启用账户".to_string() } else { "禁用账户".to_string() },
        target: user_dn,
        operator,
        status: if result.is_ok() { "success".to_string() } else { "failed".to_string() },
        detail: result.clone().err().unwrap_or_default(),
    });
    result
}

#[tauri::command]
async fn get_user_detail(cfg: AppConfig, user_dn: String) -> Result<HashMap<String, String>, String> {
    let client = LdapClient::new(cfg);
    client.get_user_detail(&user_dn).await
}

#[tauri::command]
async fn modify_user_attributes(cfg: AppConfig, user_dn: String, attrs: HashMap<String, String>) -> Result<u32, String> {
    let operator = cfg.username.clone();
    let client = LdapClient::new(cfg);
    let result = client.modify_user_attributes(&user_dn, &attrs).await;
    operation_log::append(operation_log::LogEntry {
        time: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        operation: format!("修改属性({})", attrs.keys().cloned().collect::<Vec<_>>().join(",")),
        target: user_dn,
        operator,
        status: if result.is_ok() { "success".to_string() } else { "failed".to_string() },
        detail: result.clone().err().unwrap_or_default(),
    });
    result
}

#[tauri::command]
fn get_operation_logs(limit: usize) -> Vec<operation_log::LogEntry> {
    operation_log::list(if limit == 0 { 500 } else { limit })
}

#[tauri::command]
fn parse_file(path: String) -> Result<file_parser::ParseResult, String> {
    if path.ends_with(".csv") {
        file_parser::parse_csv(&path)
    } else if path.ends_with(".xlsx") || path.ends_with(".xls") {
        file_parser::parse_excel(&path)
    } else {
        Err("不支持的文件格式".to_string())
    }
}

#[tauri::command]
fn generate_template(format: String, path: String) -> Result<(), String> {
    match format.as_str() {
        "csv" => file_parser::generate_csv_template(&path),
        _ => Err("不支持的模板格式".to_string()),
    }
}

/// Windows 11 窗口默认不给第三方框架（如 WebView2）自动圆角，
/// 需显式调用 DWM API 选择圆角；Win10/Server 2022 不支持该属性，调用返回错误直接忽略
#[cfg(target_os = "windows")]
mod win_rounded_corners {
    use std::ffi::c_void;
    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33;
    const DWMWCP_ROUND: u32 = 2;

    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmSetWindowAttribute(hwnd: isize, attr: u32, pv: *const c_void, cb: u32) -> i32;
    }

    pub fn enable(hwnd: isize) {
        let pref: u32 = DWMWCP_ROUND;
        unsafe {
            DwmSetWindowAttribute(
                hwnd,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &pref as *const u32 as *const c_void,
                std::mem::size_of::<u32>() as u32,
            );
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(hwnd) = window.hwnd() {
                        win_rounded_corners::enable(hwnd.0 as isize);
                    }
                }
            }
            #[cfg(not(target_os = "windows"))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config_cmd,
            test_connection,
            search_users,
            list_users,
            change_password,
            delete_user,
            batch_create_users,
            get_user_attributes,
            batch_change_passwords,
            batch_add_to_group,
            batch_modify_attributes,
            set_account_enabled,
            get_user_detail,
            modify_user_attributes,
            get_operation_logs,
            parse_file,
            generate_template,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
