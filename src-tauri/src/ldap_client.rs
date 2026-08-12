use ldap3::{LdapConnAsync, LdapConnSettings, Scope, SearchEntry};
use ldap3::adapters::EntriesOnly;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use crate::config::AppConfig;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const SEARCH_SIZE_LIMIT: usize = 2000;

/// Escape a value for safe interpolation into an LDAP search filter (RFC 4515)
fn ldap_escape(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for c in input.chars() {
        match c {
            '\\' => out.push_str("\\5c"),
            '*' => out.push_str("\\2a"),
            '(' => out.push_str("\\28"),
            ')' => out.push_str("\\29"),
            '\0' => out.push_str("\\00"),
            _ => out.push(c),
        }
    }
    out
}

/// AD 密码必须以 UTF-16LE 编码并加双引号包裹
fn encode_ad_password(pw: &str) -> Vec<u8> {
    format!("\"{}\"", pw)
        .encode_utf16()
        .flat_map(|c| c.to_le_bytes())
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ADUser {
    pub dn: String,
    #[serde(rename = "sAMAccountName")]
    pub s_am_account_name: String,
    pub display_name: String,
    pub mail: String,
    pub department: String,
    pub status: String,
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

impl BatchResult {
    fn from_details(details: Vec<BatchResultItem>) -> Self {
        let total = details.len();
        let success = details.iter().filter(|d| d.success).count();
        Self { total, success, failed: total - success, details }
    }
}

/// 批量创建用户的单条输入，attributes 为模板中的其余列（mail/department/title 等）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewUserSpec {
    #[serde(rename = "sAMAccountName")]
    pub s_am_account_name: String,
    pub display_name: String,
    pub ou: String,
    pub password: String,
    pub attributes: HashMap<String, String>,
}

/// 批量改密的单条输入
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchPasswordItem {
    #[serde(rename = "sAMAccountName")]
    pub s_am_account_name: String,
    pub password: String,
    pub force_change: bool,
}

pub struct LdapClient {
    config: AppConfig,
}

impl LdapClient {
    pub fn new(config: AppConfig) -> Self {
        Self { config }
    }

    /// 依次尝试三种传输方式：LDAPS(:636) → LDAP+StartTLS(:389) → 明文 LDAP(:389)。
    /// 域控未安装服务器证书时 LDAPS/StartTLS 均不可用，只能回退明文；
    /// 自建 CA 证书可在配置中开启跳过证书验证（insecure_tls）使 LDAPS 生效。
    async fn open_transport(&self) -> Result<(ldap3::Ldap, &'static str), String> {
        let settings = LdapConnSettings::new()
            .set_conn_timeout(CONNECT_TIMEOUT)
            .set_no_tls_verify(self.config.insecure_tls);
        let ssl_url = format!("ldaps://{}:636", self.config.server);
        let plain_url = format!("ldap://{}:389", self.config.server);

        // 1) LDAPS（insecure_tls 开启时跳过证书链验证）
        if let Ok((conn, ldap)) = LdapConnAsync::with_settings(settings.clone(), &ssl_url).await {
            ldap3::drive!(conn);
            return Ok((ldap, "LDAPS(SSL加密)"));
        }

        // 2) LDAP + StartTLS
        if let Ok((conn, ldap)) = LdapConnAsync::with_settings(settings.clone().set_starttls(true), &plain_url).await {
            ldap3::drive!(conn);
            return Ok((ldap, "StartTLS(加密)"));
        }

        // 3) 明文 LDAP（仅用于无证书环境，密码类操作会被 AD 拒绝）
        if let Ok((conn, ldap)) = LdapConnAsync::with_settings(settings, &plain_url).await {
            ldap3::drive!(conn);
            return Ok((ldap, "明文LDAP(未加密)"));
        }

        Err(format!("无法连接 {}: LDAPS/StartTLS/LDAP 均失败，请检查服务器地址与防火墙", self.config.server))
    }

    async fn connect(&self) -> Result<(ldap3::Ldap, &'static str), String> {
        let (mut ldap, mode) = self.open_transport().await?;

        ldap.simple_bind(&self.config.bind_dn(), &self.config.password)
            .await
            .map_err(|e| format!("认证失败: {}", e))?
            .success()
            .map_err(|e| format!("认证失败(账户或密码错误): {}", e))?;

        Ok((ldap, mode))
    }

    pub async fn test_connection(&self) -> Result<String, String> {
        let (mut ldap, mode) = self.connect().await?;
        ldap.unbind().await.ok();
        let warn = if mode.contains("明文") {
            " · 警告: 域控未安装证书，当前为未加密连接"
        } else {
            ""
        };
        Ok(format!("连接成功 · {} · 域: {}{}", mode, self.config.domain, warn))
    }

    fn uac_status(uac: u32) -> &'static str {
        if uac & 2 != 0 { "disabled" }
        else if uac & 16 != 0 { "locked" }
        else { "active" }
    }

    fn entry_to_ad_user(se: SearchEntry) -> ADUser {
        let status = se.attrs.get("userAccountControl")
            .and_then(|v| v.first())
            .and_then(|v| v.parse::<u32>().ok())
            .map(Self::uac_status)
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
    }

    /// 是否为系统内置账户：机器账户($结尾)、krbtgt、Guest
    fn is_system_account(name: &str) -> bool {
        let lower = name.to_lowercase();
        lower.ends_with('$') || lower == "krbtgt" || lower == "guest"
    }

    const USER_ATTRS: [&'static str; 5] = ["sAMAccountName", "displayName", "mail", "department", "userAccountControl"];

    pub async fn search_users(&self, keyword: &str, _ou_filter: &str) -> Result<Vec<ADUser>, String> {
        let (mut ldap, _) = self.connect().await?;
        let base_dn = self.config.base_dn();

        let kw = ldap_escape(keyword);
        let filter = format!("(&(objectClass=user)(objectCategory=person)(|(sAMAccountName=*{}*)(displayName=*{}*)(mail=*{}*)))", kw, kw, kw);

        // 流式拉取并限制最大条数，避免大域全量进内存；
        // 必须用 EntriesOnly 适配器：AD 会返回搜索引用(referral)消息，
        // 不过滤会被当成条目解析导致 panic
        let mut stream = ldap.streaming_search_with(EntriesOnly::new(), &base_dn, Scope::Subtree, &filter, Self::USER_ATTRS.to_vec())
            .await
            .map_err(|e| format!("搜索失败: {}", e))?;

        let mut users: Vec<ADUser> = Vec::new();
        while let Some(entry) = stream.next().await.map_err(|e| format!("搜索失败: {}", e))? {
            if users.len() >= SEARCH_SIZE_LIMIT {
                break;
            }
            users.push(Self::entry_to_ad_user(SearchEntry::construct(entry)));
        }
        let _ = stream.finish().await;

        ldap.unbind().await.ok();
        Ok(users)
    }

    /// 列出 Users 容器下的用户（排除系统内置账户），用于搜索页默认展示
    pub async fn list_users(&self) -> Result<Vec<ADUser>, String> {
        let (mut ldap, _) = self.connect().await?;
        let base = format!("CN=Users,{}", self.config.base_dn());
        let filter = "(&(objectClass=user)(objectCategory=person))";

        let mut stream = ldap.streaming_search_with(EntriesOnly::new(), &base, Scope::Subtree, filter, Self::USER_ATTRS.to_vec())
            .await
            .map_err(|e| format!("查询用户列表失败: {}", e))?;

        let mut users: Vec<ADUser> = Vec::new();
        while let Some(entry) = stream.next().await.map_err(|e| format!("查询用户列表失败: {}", e))? {
            if users.len() >= SEARCH_SIZE_LIMIT {
                break;
            }
            let user = Self::entry_to_ad_user(SearchEntry::construct(entry));
            if !Self::is_system_account(&user.s_am_account_name) {
                users.push(user);
            }
        }
        let _ = stream.finish().await;

        ldap.unbind().await.ok();
        Ok(users)
    }

    /// 按 sAMAccountName 精确查找用户 DN（批量操作的定位基础）
    async fn find_user_dn(ldap: &mut ldap3::Ldap, base_dn: &str, username: &str) -> Result<Option<String>, String> {
        let filter = format!("(&(objectClass=user)(objectCategory=person)(sAMAccountName={}))", ldap_escape(username));
        let (rs, _rc) = ldap.search(base_dn, Scope::Subtree, &filter, vec!["dn"])
            .await
            .map_err(|e| format!("查询用户失败: {}", e))?
            .success()
            .map_err(|e| format!("查询用户失败: {}", e))?;
        Ok(rs.into_iter().next().map(|e| SearchEntry::construct(e).dn))
    }

    /// 按名称查找组 DN
    async fn find_group_dn(ldap: &mut ldap3::Ldap, base_dn: &str, group: &str) -> Result<Option<String>, String> {
        // 支持直接传完整 DN
        if group.contains('=') {
            return Ok(Some(group.to_string()));
        }
        let filter = format!("(&(objectClass=group)(sAMAccountName={}))", ldap_escape(group));
        let (rs, _rc) = ldap.search(base_dn, Scope::Subtree, &filter, vec!["dn"])
            .await
            .map_err(|e| format!("查询组失败: {}", e))?
            .success()
            .map_err(|e| format!("查询组失败: {}", e))?;
        Ok(rs.into_iter().next().map(|e| SearchEntry::construct(e).dn))
    }

    /// 读取条目上某属性的当前值（追加模式用）
    async fn get_attr_value(ldap: &mut ldap3::Ldap, dn: &str, attr: &str) -> Result<String, String> {
        let (rs, _rc) = ldap.search(dn, Scope::Base, "(objectClass=*)", vec![attr])
            .await
            .map_err(|e| format!("读取属性失败: {}", e))?
            .success()
            .map_err(|e| format!("读取属性失败: {}", e))?;
        Ok(rs.into_iter().next()
            .map(|e| SearchEntry::construct(e))
            .and_then(|se| se.attrs.get(attr).and_then(|v| v.first()).cloned())
            .unwrap_or_default())
    }

    pub async fn change_password(&self, user_dn: &str, new_password: &str, force_change: bool) -> Result<(), String> {
        let (mut ldap, _) = self.connect().await?;
        Self::change_password_impl(&mut ldap, user_dn, new_password, force_change).await?;
        ldap.unbind().await.ok();
        Ok(())
    }

    async fn change_password_impl(ldap: &mut ldap3::Ldap, user_dn: &str, new_password: &str, force_change: bool) -> Result<(), String> {
        let mut vals: HashSet<Vec<u8>> = HashSet::new();
        vals.insert(encode_ad_password(new_password));
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

        Ok(())
    }

    /// 创建用户：add 条目 → 设置密码激活。返回 Ok(密码是否设置成功)。
    /// 条目已创建但设密失败时返回 Ok(false)，避免上层误判为未创建而重复提交
    async fn create_user_impl(ldap: &mut ldap3::Ldap, config: &AppConfig, spec: &NewUserSpec) -> Result<bool, String> {
        if spec.s_am_account_name.trim().is_empty() {
            return Err("缺少用户名(sAMAccountName)".to_string());
        }
        if spec.password.len() < 8 {
            return Err("初始密码长度不能少于 8 位".to_string());
        }

        let cn = if spec.display_name.trim().is_empty() {
            spec.s_am_account_name.clone()
        } else {
            spec.display_name.clone()
        };
        let base_dn = config.base_dn();
        let parent = if spec.ou.trim().is_empty() { base_dn.clone() } else { spec.ou.trim().to_string() };
        let dn = format!("CN={},{}", cn, parent);

        let upn = spec.attributes.get("userPrincipalName")
            .filter(|v| !v.trim().is_empty())
            .cloned()
            .unwrap_or_else(|| format!("{}@{}", spec.s_am_account_name, config.domain));

        let mut attrs: Vec<(String, HashSet<String>)> = vec![
            // AD 创建必须显式携带 objectClass，否则报 rc=65 objectClassViolation
            ("objectClass".to_string(), HashSet::from(["user".to_string()])),
            ("sAMAccountName".to_string(), HashSet::from([spec.s_am_account_name.clone()])),
            ("userPrincipalName".to_string(), HashSet::from([upn])),
        ];
        if !spec.display_name.trim().is_empty() {
            attrs.push(("displayName".to_string(), HashSet::from([spec.display_name.clone()])));
        }
        // 模板中的其余列（mail/department/title/telephoneNumber 等）
        for (k, v) in &spec.attributes {
            let v = v.trim();
            if v.is_empty() { continue; }
            match k.as_str() {
                // 已单独处理的属性跳过，避免重复值导致 add 失败；
                // userAccountControl 不能在 add 时设置（rc=53），改密后再启用
                "userPrincipalName" | "sAMAccountName" | "displayName" | "ou" | "password" | "objectClass" | "userAccountControl" => continue,
                _ => attrs.push((k.clone(), HashSet::from([v.to_string()]))),
            }
        }

        let add_attrs: Vec<(&str, HashSet<&str>)> = attrs.iter()
            .map(|(k, vs)| (k.as_str(), vs.iter().map(|s| s.as_str()).collect()))
            .collect();

        ldap.add(&dn, add_attrs)
            .await
            .map_err(|e| format!("创建用户条目失败: {}", e))?
            .success()
            .map_err(|e| format!("创建用户条目失败: {}", e))?;

        // AD 标准三步流程：add（默认禁用）→ 设密 → 改 UAC=512 启用。
        // 设密失败（如无加密通道时 AD 拒绝改 unicodePwd）不启用账户，
        // 标记为已创建、待设密，用户可用批量改密补救
        match Self::change_password_impl(ldap, &dn, &spec.password, false).await {
            Ok(()) => {
                let mut vals: HashSet<Vec<u8>> = HashSet::new();
                vals.insert(b"512".to_vec());
                ldap.modify(&dn, vec![ldap3::Mod::Replace(b"userAccountControl".to_vec(), vals)])
                    .await
                    .map_err(|e| format!("启用账户失败: {}", e))?
                    .success()
                    .map_err(|e| format!("启用账户失败: {}", e))?;
                Ok(true)
            }
            Err(_) => Ok(false),
        }
    }

    pub async fn batch_create_users(&self, users: Vec<NewUserSpec>) -> Result<BatchResult, String> {
        let (mut ldap, _) = self.connect().await?;
        let mut details = Vec::with_capacity(users.len());
        for spec in &users {
            let res = Self::create_user_impl(&mut ldap, &self.config, spec).await;
            details.push(match res {
                Ok(true) => BatchResultItem {
                    username: spec.s_am_account_name.clone(),
                    success: true,
                    message: "创建成功".to_string(),
                },
                Ok(false) => BatchResultItem {
                    username: spec.s_am_account_name.clone(),
                    success: true,
                    message: "用户已创建，但初始密码设置失败（域控未启用加密通道时 AD 拒绝改密），请勿重复创建，可用批量改密重试".to_string(),
                },
                Err(e) => BatchResultItem {
                    username: spec.s_am_account_name.clone(),
                    success: false,
                    message: e,
                },
            });
        }
        ldap.unbind().await.ok();
        Ok(BatchResult::from_details(details))
    }

    pub async fn batch_change_passwords(&self, items: Vec<BatchPasswordItem>) -> Result<BatchResult, String> {
        let (mut ldap, _) = self.connect().await?;
        let base_dn = self.config.base_dn();
        let mut details = Vec::with_capacity(items.len());

        for item in &items {
            let res = async {
                if item.password.len() < 8 {
                    return Err("密码长度不能少于 8 位".to_string());
                }
                let dn = Self::find_user_dn(&mut ldap, &base_dn, &item.s_am_account_name).await?
                    .ok_or_else(|| "用户不存在".to_string())?;
                Self::change_password_impl(&mut ldap, &dn, &item.password, item.force_change).await
            }.await;

            details.push(match res {
                Ok(()) => BatchResultItem {
                    username: item.s_am_account_name.clone(),
                    success: true,
                    message: "密码已修改".to_string(),
                },
                Err(e) => BatchResultItem {
                    username: item.s_am_account_name.clone(),
                    success: false,
                    message: e,
                },
            });
        }

        ldap.unbind().await.ok();
        Ok(BatchResult::from_details(details))
    }

    pub async fn batch_add_to_group(&self, usernames: Vec<String>, groups: Vec<String>) -> Result<BatchResult, String> {
        if groups.is_empty() {
            return Err("未指定目标组".to_string());
        }
        let (mut ldap, _) = self.connect().await?;
        let base_dn = self.config.base_dn();

        // 先解析所有组 DN，避免逐用户重复查询
        let mut group_dns: Vec<String> = Vec::with_capacity(groups.len());
        for g in &groups {
            match Self::find_group_dn(&mut ldap, &base_dn, g).await? {
                Some(dn) => group_dns.push(dn),
                None => return Err(format!("组不存在: {}", g)),
            }
        }

        let mut details = Vec::with_capacity(usernames.len());
        for username in &usernames {
            let res = async {
                let user_dn = Self::find_user_dn(&mut ldap, &base_dn, username).await?
                    .ok_or_else(|| "用户不存在".to_string())?;
                for gdn in &group_dns {
                    let mut vals: HashSet<Vec<u8>> = HashSet::new();
                    vals.insert(user_dn.clone().into_bytes());
                    let mods: Vec<ldap3::Mod<Vec<u8>>> = vec![
                        ldap3::Mod::Add(b"member".to_vec(), vals),
                    ];
                    ldap.modify(gdn, mods)
                        .await
                        .map_err(|e| format!("加入组失败: {}", e))?
                        .success()
                        .map_err(|e| format!("加入组失败: {}", e))?;
                }
                Ok(())
            }.await;

            details.push(match res {
                Ok(()) => BatchResultItem {
                    username: username.clone(),
                    success: true,
                    message: format!("已加入 {} 个组", group_dns.len()),
                },
                Err(e) => BatchResultItem {
                    username: username.clone(),
                    success: false,
                    message: e,
                },
            });
        }

        ldap.unbind().await.ok();
        Ok(BatchResult::from_details(details))
    }

    /// 批量修改属性。mods: {属性名: 新值}；per_user_values 优先于统一值（文件读取模式，
    /// 用户缺失某属性键时跳过该属性）。append 为 true 时在现有值后追加。
    pub async fn batch_modify_attributes(
        &self,
        usernames: Vec<String>,
        mods: HashMap<String, String>,
        per_user_values: HashMap<String, HashMap<String, String>>,
        append: bool,
    ) -> Result<BatchResult, String> {
        if mods.is_empty() {
            return Err("未指定要修改的属性".to_string());
        }
        let (mut ldap, _) = self.connect().await?;
        let base_dn = self.config.base_dn();

        let mut details = Vec::with_capacity(usernames.len());
        for username in &usernames {
            let res = async {
                let dn = Self::find_user_dn(&mut ldap, &base_dn, username).await?
                    .ok_or_else(|| "用户不存在".to_string())?;
                let user_overrides = per_user_values.get(username);

                let mut ldap_mods: Vec<ldap3::Mod<Vec<u8>>> = Vec::new();
                for (attr, value) in &mods {
                    // 文件模式下该用户未提供此属性则跳过，不清空原值
                    let base_value = match user_overrides {
                        Some(m) => match m.get(attr) {
                            Some(v) => v.as_str(),
                            None => continue,
                        },
                        None => value.as_str(),
                    };
                    let final_value = if append {
                        let current = Self::get_attr_value(&mut ldap, &dn, attr).await?;
                        format!("{}{}", current, base_value)
                    } else {
                        base_value.to_string()
                    };
                    let mut vals: HashSet<Vec<u8>> = HashSet::new();
                    vals.insert(final_value.into_bytes());
                    ldap_mods.push(ldap3::Mod::Replace(attr.as_bytes().to_vec(), vals));
                }
                if ldap_mods.is_empty() {
                    return Err("没有有效的属性修改项".to_string());
                }
                ldap.modify(&dn, ldap_mods)
                    .await
                    .map_err(|e| format!("修改属性失败: {}", e))?
                    .success()
                    .map_err(|e| format!("修改属性失败: {}", e))?;
                Ok(())
            }.await;

            details.push(match res {
                Ok(()) => BatchResultItem {
                    username: username.clone(),
                    success: true,
                    message: "属性已更新".to_string(),
                },
                Err(e) => BatchResultItem {
                    username: username.clone(),
                    success: false,
                    message: e,
                },
            });
        }

        ldap.unbind().await.ok();
        Ok(BatchResult::from_details(details))
    }

    pub async fn delete_user(&self, user_dn: &str) -> Result<(), String> {
        let (mut ldap, _) = self.connect().await?;

        ldap.delete(user_dn)
            .await
            .map_err(|e| format!("删除用户失败: {}", e))?
            .success()
            .map_err(|e| format!("删除用户失败: {}", e))?;

        ldap.unbind().await.ok();
        Ok(())
    }
}
