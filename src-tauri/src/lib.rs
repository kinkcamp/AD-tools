mod config;
mod ldap_client;
mod file_parser;

use config::AppConfig;
use ldap_client::LdapClient;

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
async fn search_users(cfg: AppConfig, keyword: String, ou_filter: String) -> Result<Vec<ldap_client::ADUser>, String> {
    let client = LdapClient::new(cfg);
    client.search_users(&keyword, &ou_filter).await
}

#[tauri::command]
async fn change_password(cfg: AppConfig, user_dn: String, new_password: String, force_change: bool) -> Result<(), String> {
    let client = LdapClient::new(cfg);
    client.change_password(&user_dn, &new_password, force_change).await
}

#[tauri::command]
async fn delete_user(cfg: AppConfig, user_dn: String) -> Result<(), String> {
    let client = LdapClient::new(cfg);
    client.delete_user(&user_dn).await
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config_cmd,
            test_connection,
            search_users,
            change_password,
            delete_user,
            parse_file,
            generate_template,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
