use ldap3::{LdapConnAsync, LdapConnSettings, Scope, SearchEntry};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use crate::config::AppConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ADUser {
    pub dn: String,
    pub s_am_account_name: String,
    pub display_name: String,
    pub mail: String,
    pub department: String,
    pub status: String, // "active", "disabled", "locked"
    pub last_login: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResult {
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub details: Vec<BatchResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResultItem {
    pub username: String,
    pub success: bool,
    pub message: String,
}

pub struct LdapClient {
    config: AppConfig,
}

impl LdapClient {
    pub fn new(config: AppConfig) -> Self {
        Self { config }
    }

    async fn connect(&self) -> Result<ldap3::Ldap, String> {
        let url = if self.config.ssl_enabled {
            format!("ldaps://{}:{}", self.config.ldap_host, self.config.ldap_port)
        } else {
            format!("ldap://{}:{}", self.config.ldap_host, self.config.ldap_port)
        };

        let settings = LdapConnSettings::new()
            .set_no_tls_verify(!self.config.verify_cert);

        let (conn, mut ldap) = LdapConnAsync::with_settings(settings, &url)
            .await
            .map_err(|e| format!("连接失败: {}", e))?;

        ldap3::drive!(conn);

        // simple_bind().await returns Result<LdapResult, LdapError>
        // .success() on Result<LdapResult, LdapError> returns Result<LdapResult, LdapError>
        ldap.simple_bind(&self.config.bind_dn, &self.config.bind_password)
            .await
            .map_err(|e| format!("认证失败: {}", e))?
            .success()
            .map_err(|e| format!("认证失败: {}", e))?;

        Ok(ldap)
    }

    pub async fn test_connection(&self) -> Result<String, String> {
        let url = if self.config.ssl_enabled {
            format!("ldaps://{}:{}", self.config.ldap_host, self.config.ldap_port)
        } else {
            format!("ldap://{}:{}", self.config.ldap_host, self.config.ldap_port)
        };

        let mut ldap = self.connect().await?;
        ldap.unbind().await.ok();
        Ok(format!("连接成功: {}", url))
    }

    pub async fn search_users(&self, keyword: &str, _ou_filter: &str) -> Result<Vec<ADUser>, String> {
        let mut ldap = self.connect().await?;

        let filter = format!("(&(objectClass=user)(|(sAMAccountName=*{}*)(displayName=*{}*)(mail=*{}*)))", keyword, keyword, keyword);
        let attrs = vec!["sAMAccountName", "displayName", "mail", "department", "userAccountControl", "lastLogon"];

        let (rs, _rc) = ldap.search(&self.config.base_dn, Scope::Subtree, &filter, attrs)
            .await
            .map_err(|e| format!("搜索失败: {}", e))?
            .success()
            .map_err(|e| format!("搜索失败: {}", e))?;

        let users: Vec<ADUser> = rs.into_iter().map(|entry| {
            let se = SearchEntry::construct(entry);
            let status = se.attrs.get("userAccountControl")
                .and_then(|v| v.first())
                .and_then(|v| v.parse::<u32>().ok())
                .map(|uac| {
                    if uac & 2 != 0 { "disabled" }
                    else if uac & 16 != 0 { "locked" }
                    else { "active" }
                })
                .unwrap_or("active");

            ADUser {
                dn: se.dn,
                s_am_account_name: se.attrs.get("sAMAccountName").and_then(|v| v.first()).cloned().unwrap_or_default(),
                display_name: se.attrs.get("displayName").and_then(|v| v.first()).cloned().unwrap_or_default(),
                mail: se.attrs.get("mail").and_then(|v| v.first()).cloned().unwrap_or_default(),
                department: se.attrs.get("department").and_then(|v| v.first()).cloned().unwrap_or_default(),
                status: status.to_string(),
                last_login: String::new(),
            }
        }).collect();

        ldap.unbind().await.ok();
        Ok(users)
    }

    pub async fn change_password(&self, user_dn: &str, new_password: &str, force_change: bool) -> Result<(), String> {
        let mut ldap = self.connect().await?;

        // Encode password as UTF-16LE wrapped in quotes
        let encoded_pw: Vec<u8> = format!("\"{}\"", new_password)
            .encode_utf16()
            .flat_map(|c| c.to_le_bytes())
            .collect();

        let mut vals: HashSet<Vec<u8>> = HashSet::new();
        vals.insert(encoded_pw);
        let mods: Vec<ldap3::Mod<Vec<u8>>> = vec![
            ldap3::Mod::Replace(b"unicodePwd".to_vec(), vals),
        ];

        ldap.modify(user_dn, mods)
            .await
            .map_err(|e| format!("修改密码失败: {}", e))?
            .success()
            .map_err(|e| format!("修改密码失败: {}", e))?;

        if force_change {
            let mut vals: HashSet<Vec<u8>> = HashSet::new();
            vals.insert(b"0".to_vec());
            let mods: Vec<ldap3::Mod<Vec<u8>>> = vec![
                ldap3::Mod::Replace(b"pwdLastSet".to_vec(), vals),
            ];

            ldap.modify(user_dn, mods)
                .await
                .map_err(|e| format!("设置强制修改密码失败: {}", e))?
                .success()
                .map_err(|e| format!("设置强制修改密码失败: {}", e))?;
        }

        ldap.unbind().await.ok();
        Ok(())
    }

    pub async fn batch_add_to_group(&self, usernames: &[String], group_dn: &str) -> Result<BatchResult, String> {
        let mut details = Vec::new();
        let mut success_count = 0;

        for username in usernames {
            match self.add_user_to_group(username, group_dn).await {
                Ok(_) => {
                    success_count += 1;
                    details.push(BatchResultItem {
                        username: username.clone(),
                        success: true,
                        message: "已加入组".to_string(),
                    });
                }
                Err(e) => {
                    details.push(BatchResultItem {
                        username: username.clone(),
                        success: false,
                        message: e,
                    });
                }
            }
        }

        Ok(BatchResult {
            total: usernames.len(),
            success: success_count,
            failed: usernames.len() - success_count,
            details,
        })
    }

    async fn add_user_to_group(&self, username: &str, group_dn: &str) -> Result<(), String> {
        let user_dn = format!("CN={},{}", username, self.config.base_dn);
        let mut ldap = self.connect().await?;

        let mut vals: HashSet<Vec<u8>> = HashSet::new();
        vals.insert(user_dn.into_bytes());
        let mods: Vec<ldap3::Mod<Vec<u8>>> = vec![
            ldap3::Mod::Add(b"member".to_vec(), vals),
        ];

        ldap.modify(group_dn, mods)
            .await
            .map_err(|e| format!("加入组失败: {}", e))?
            .success()
            .map_err(|e| format!("加入组失败: {}", e))?;

        ldap.unbind().await.ok();
        Ok(())
    }

    pub async fn delete_user(&self, user_dn: &str) -> Result<(), String> {
        let mut ldap = self.connect().await?;

        ldap.delete(user_dn)
            .await
            .map_err(|e| format!("删除用户失败: {}", e))?
            .success()
            .map_err(|e| format!("删除用户失败: {}", e))?;

        ldap.unbind().await.ok();
        Ok(())
    }
}
