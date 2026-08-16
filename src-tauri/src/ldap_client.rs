use ldap3::{LdapConnAsync, LdapConnSettings, Scope, SearchEntry};
use ldap3::adapters::EntriesOnly;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::Duration;
use crate::config::AppConfig;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const SEARCH_SIZE_LIMIT: usize = 5000;

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
    // 用户所在组（memberOf 提取组名，逗号分隔）
    pub groups: String,
    pub status: String,
    pub last_login: String,
    // POSIX 属性（Identity Management for UNIX），未设置时为空字符串
    #[serde(rename = "uidNumber")]
    pub uid_number: String,
    #[serde(rename = "gidNumber")]
    pub gid_number: String,
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

/// 批量创建实时进度事件（通过 Tauri 事件推送到前端）
/// phase: check=预检查 create=创建；status: checking/creating/success/failed
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProgressEvent {
    pub phase: String,
    pub username: String,
    pub status: String,
    pub message: String,
    pub current: usize,
    pub total: usize,
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

        // 部门 = 用户所在 OU/容器名称（department 属性普遍未填，按需求以 OU 为准）
        let department = Self::container_name_from_dn(&se.dn);
        // 所在组：memberOf 各 DN 取首个 RDN 的组名
        let groups = se.attrs.get("memberOf").map(|vs| {
            vs.iter().map(|dn| {
                let rdn = dn.split(',').next().unwrap_or(dn);
                rdn.splitn(2, '=').nth(1).unwrap_or(rdn)
            }).collect::<Vec<_>>().join(", ")
        }).unwrap_or_default();

        ADUser {
            dn: se.dn,
            s_am_account_name: se.attrs.get("sAMAccountName").and_then(|v| v.first()).cloned().unwrap_or_default(),
            display_name: se.attrs.get("displayName").and_then(|v| v.first()).cloned().unwrap_or_default(),
            mail: se.attrs.get("mail").and_then(|v| v.first()).cloned().unwrap_or_default(),
            department,
            groups,
            status: status.to_string(),
            last_login: String::new(),
            uid_number: se.attrs.get("uidNumber").and_then(|v| v.first()).cloned().unwrap_or_default(),
            gid_number: se.attrs.get("gidNumber").and_then(|v| v.first()).cloned().unwrap_or_default(),
        }
    }

    /// 从用户 DN 取父容器名称：CN=x,OU=EDA,DC=... → "EDA"；CN=x,CN=Users,... → "Users"
    fn container_name_from_dn(dn: &str) -> String {
        let mut parts = dn.split(',');
        parts.next(); // 跳过用户自身的 CN
        match parts.next() {
            Some(p) => {
                let p = p.trim();
                if p.to_ascii_lowercase().starts_with("dc=") { return String::new(); }
                p.splitn(2, '=').nth(1).unwrap_or(p).to_string()
            }
            None => String::new(),
        }
    }

    /// 是否为系统内置账户：机器账户($结尾)、krbtgt、Guest
    fn is_system_account(name: &str) -> bool {
        let lower = name.to_lowercase();
        lower.ends_with('$') || lower == "krbtgt" || lower == "guest"
    }

    const USER_ATTRS: [&'static str; 8] = ["sAMAccountName", "displayName", "mail", "department", "userAccountControl", "uidNumber", "gidNumber", "memberOf"];

    pub async fn search_users(&self, keyword: &str) -> Result<Vec<ADUser>, String> {
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

    /// 列出全域用户（所有 OU/容器，排除系统内置账户），用于搜索页默认展示
    pub async fn list_users(&self) -> Result<Vec<ADUser>, String> {
        let (mut ldap, _) = self.connect().await?;
        // 从域根全量扫描，覆盖所有 OU/容器（早期只查 CN=Users，导入到其他 OU 的用户读不到）
        let base = self.config.base_dn();
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

    /// 把模板里的 OU 值解析为完整 DN：
    /// - 含逗号的视为完整 DN，直接做存在性校验（大小写不敏感匹配）
    /// - 纯名称（EDA）或 OU=/CN= 前缀的简写，在域内搜索同名 OU/容器，
    ///   唯一命中则自动拼成完整 DN；多个同名时要求用户写完整 DN
    async fn resolve_ou_dn(ldap: &mut ldap3::Ldap, base_dn: &str, raw: &str) -> Result<String, String> {
        let ou = raw.trim();
        if ou.contains(',') {
            let res = ldap.search(ou, Scope::Base, "(objectClass=*)", vec!["distinguishedName"]).await
                .map_err(|e| e.to_string())?;
            let (entries, _) = res.success().map_err(|e| e.to_string())?;
            return entries.first()
                .map(|e| SearchEntry::construct(e.clone()).dn)
                .ok_or_else(|| format!("OU 不存在: {}", ou));
        }
        // 简写：去掉可选的 OU=/CN= 前缀后按名称搜索
        let name = if ou.to_ascii_lowercase().starts_with("ou=") || ou.to_ascii_lowercase().starts_with("cn=") {
            &ou[3..]
        } else {
            ou
        };
        let esc = name.replace('\\', "\\5c").replace('*', "\\2a").replace('(', "\\28").replace(')', "\\29");
        let filter = format!("(&(|(objectClass=organizationalUnit)(objectClass=container))(name={}))", esc);
        let res = ldap.search(base_dn, Scope::Subtree, &filter, vec!["distinguishedName"]).await
            .map_err(|e| e.to_string())?;
        let (entries, _) = res.success().map_err(|e| e.to_string())?;
        match entries.len() {
            0 => Err(format!("域内找不到名为 {} 的 OU/容器", name)),
            1 => Ok(SearchEntry::construct(entries.into_iter().next().unwrap()).dn),
            n => Err(format!("域内有 {} 个同名容器（{}），请在模板中填写完整 DN", n, name)),
        }
    }

    /// 创建用户：add 条目 → 设置密码激活。返回 Ok((密码是否设置成功, 同名改名后的显示名))。
    /// 条目已创建但设密失败时返回 Ok(false, _)，避免上层误判为未创建而重复提交
    async fn create_user_impl(ldap: &mut ldap3::Ldap, config: &AppConfig, spec: &NewUserSpec) -> Result<(bool, Option<String>), String> {
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
        // 模板中的其余列（mail/department/title/telephoneNumber 等），有值才写入
        for (k, v) in &spec.attributes {
            let v = v.trim();
            if v.is_empty() { continue; }
            // 跳过清单（大小写不敏感）：已单独处理的 + 系统/只读/危险属性
            //（模板现在含 schema 全量字段，必须拦住不能由文件设置的列）
            let lk = k.to_ascii_lowercase();
            const SKIP_ATTRS: &[&str] = &[
                "userprincipalname", "samaccountname", "displayname", "ou", "password",
                "objectclass", "useraccountcontrol",
                "objectcategory", "objectguid", "objectsid", "name", "cn",
                "instancetype", "whencreated", "whenchanged", "usncreated", "usnchanged",
                "usnlastobjrem", "unicodepwd", "lmpassword", "ntpassword",
                "dscorepropagationdata", "replpropertymetadata", "replugtofdvector",
                "priorsettime", "priorparent", "isdeleted", "isrecycled", "lastknownparent",
                "msds-principalname", "msds-userpasswordexpirytimecomputed", "tokengroups",
                "memberof", "primarygroupid",
            ];
            if SKIP_ATTRS.contains(&lk.as_str()) { continue; }
            attrs.push((k.clone(), HashSet::from([v.to_string()])));
        }

        let add_attrs: Vec<(&str, HashSet<&str>)> = attrs.iter()
            .map(|(k, vs)| (k.as_str(), vs.iter().map(|s| s.as_str()).collect()))
            .collect();

        // add：AD 的 DN 由 CN（显示名）决定，同名用户会报 rc=68 entryAlreadyExists，
        // 此时自动加数字后缀重试（张三 → 张三2），与登录名去重规则一致
        let mut suffix = 0usize;
        let (dn, renamed_to) = loop {
            let try_cn = if suffix == 0 { cn.clone() } else { format!("{}{}", cn, suffix + 1) };
            let try_dn = format!("CN={},{}", try_cn, parent);
            match ldap.add(&try_dn, add_attrs.clone()).await {
                Ok(res) => match res.success() {
                    Ok(_) => break (try_dn, if suffix == 0 { None } else { Some(try_cn) }),
                    // rc=68 entryAlreadyExists：同容器内 CN 冲突，换后缀重试
                    Err(ldap3::LdapError::LdapResult { result: ldap3::LdapResult { rc: 68, .. }, .. }) => {
                        suffix += 1;
                        if suffix > 99 {
                            return Err(format!("创建用户条目失败: 同名用户过多，无法生成唯一显示名（{}）", cn));
                        }
                        continue;
                    }
                    Err(e) => return Err(format!("创建用户条目失败: {}", e)),
                },
                Err(e) => return Err(format!("创建用户条目失败: {}", e)),
            }
        };

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
                Ok((true, renamed_to))
            }
            Err(_) => Ok((false, renamed_to)),
        }
    }

    pub async fn batch_create_users<F>(&self, mut users: Vec<NewUserSpec>, emit: F) -> Result<BatchResult, String>
    where
        F: Fn(CreateProgressEvent),
    {
        let (mut ldap, _) = self.connect().await?;
        let total = users.len();

        // 阶段1 预检查：文件内重名 + 域内已存在（一次性批量查询，避免逐个往返）
        emit(CreateProgressEvent {
            phase: "check".to_string(), username: String::new(), status: "checking".to_string(),
            message: format!("预检查：查询域内已有用户（0/{}）", total), current: 0, total,
        });
        // 域内已存在的用户名集合（小写比较，sAMAccountName 不区分大小写）
        let mut existing: HashSet<String> = HashSet::new();
        let mut queried = 0usize;
        while queried < users.len() {
            let chunk_end = (queried + 200).min(users.len());
            let ors: Vec<String> = users[queried..chunk_end].iter()
                .map(|u| format!("(sAMAccountName={})", ldap_escape(&u.s_am_account_name)))
                .collect();
            let filter = format!("(|{})", ors.join(""));
            let mut stream = ldap.streaming_search_with(
                EntriesOnly::new(), &self.config.base_dn(), Scope::Subtree, &filter, vec!["sAMAccountName"],
            ).await.map_err(|e| format!("预检查查询失败: {}", e))?;
            while let Some(entry) = stream.next().await.map_err(|e| format!("预检查查询失败: {}", e))? {
                let se = SearchEntry::construct(entry);
                if let Some(name) = se.attrs.get("sAMAccountName").and_then(|v| v.first()) {
                    existing.insert(name.to_lowercase());
                }
            }
            let _ = stream.finish().await;
            queried = chunk_end;
            emit(CreateProgressEvent {
                phase: "check".to_string(), username: String::new(), status: "checking".to_string(),
                message: format!("预检查：查询域内已有用户（{}/{}）", queried, total), current: 0, total,
            });
        }

        // 文件内重名检测（保留首个，后续跳过）
        let mut seen_in_file: HashMap<String, bool> = HashMap::new();
        let mut details = Vec::with_capacity(total);

        // 阶段1.5 OU 解析与存在性预检查：支持简写（EDA / OU=EDA）自动解析为完整 DN，
        // 不存在时 AD 会报难懂的 rc=10 referral/rc=32，提前拦截并给出明确提示
        let base_dn = self.config.base_dn();
        let raw_parents: HashSet<String> = users.iter()
            .map(|u| if u.ou.trim().is_empty() { base_dn.clone() } else { u.ou.trim().to_string() })
            .collect();
        let mut ou_resolved: HashMap<String, String> = HashMap::new();
        let mut bad_parents: HashSet<String> = HashSet::new();
        for raw in &raw_parents {
            match Self::resolve_ou_dn(&mut ldap, &base_dn, raw).await {
                Ok(dn) => { ou_resolved.insert(raw.clone(), dn); }
                Err(_) => { bad_parents.insert(raw.clone()); }
            }
        }
        // 解析结果回写：后续存在性检查与创建均使用完整 DN
        for u in users.iter_mut() {
            let key = if u.ou.trim().is_empty() { base_dn.clone() } else { u.ou.trim().to_string() };
            if let Some(dn) = ou_resolved.get(&key) {
                u.ou = dn.clone();
            }
        }
        let mut container_hint = String::new();
        if !bad_parents.is_empty() {
            if let Ok(mut stream) = ldap.streaming_search_with(
                EntriesOnly::new(), &self.config.base_dn(), Scope::OneLevel,
                "(|(objectClass=organizationalUnit)(objectClass=container))", vec!["distinguishedName"],
            ).await {
                let mut names: Vec<String> = Vec::new();
                while let Ok(Some(entry)) = stream.next().await {
                    names.push(SearchEntry::construct(entry).dn);
                }
                let _ = stream.finish().await;
                if !names.is_empty() {
                    container_hint = format!("。域内可用容器: {}", names.join(" / "));
                }
            }
        }

        // 阶段2 逐个创建，每完成一个实时推送进度
        for (i, spec) in users.iter().enumerate() {
            let name_lc = spec.s_am_account_name.to_lowercase();
            let parent = if spec.ou.trim().is_empty() { self.config.base_dn() } else { spec.ou.trim().to_string() };
            let item = if *seen_in_file.get(&name_lc).unwrap_or(&false) {
                BatchResultItem {
                    username: spec.s_am_account_name.clone(),
                    success: false,
                    message: "文件内用户名重复，已跳过".to_string(),
                }
            } else if bad_parents.contains(&parent) {
                BatchResultItem {
                    username: spec.s_am_account_name.clone(),
                    success: false,
                    message: format!("目标 OU 在域中不存在或格式无效（{}），已跳过，请修改 ou 列或默认 OU{}", parent, container_hint),
                }
            } else if existing.contains(&name_lc) {
                BatchResultItem {
                    username: spec.s_am_account_name.clone(),
                    success: false,
                    message: "用户已存在于域中，已跳过".to_string(),
                }
            } else {
                seen_in_file.insert(name_lc.clone(), true);
                emit(CreateProgressEvent {
                    phase: "create".to_string(), username: spec.s_am_account_name.clone(),
                    status: "creating".to_string(), message: "创建中".to_string(),
                    current: i + 1, total,
                });
                match Self::create_user_impl(&mut ldap, &self.config, spec).await {
                    Ok((true, renamed)) => BatchResultItem {
                        username: spec.s_am_account_name.clone(),
                        success: true,
                        message: match renamed {
                            Some(cn) => format!("创建成功（同名自动改名显示名为: {}）", cn),
                            None => "创建成功".to_string(),
                        },
                    },
                    Ok((false, renamed)) => BatchResultItem {
                        username: spec.s_am_account_name.clone(),
                        success: true,
                        message: format!("用户已创建{}，但初始密码设置失败（域控未启用加密通道时 AD 拒绝改密），请勿重复创建，可用批量改密重试",
                            renamed.map(|cn| format!("（显示名: {}）", cn)).unwrap_or_default()),
                    },
                    Err(e) => BatchResultItem {
                        username: spec.s_am_account_name.clone(),
                        success: false,
                        message: e,
                    },
                }
            };

            let detail = item.clone();
            details.push(item);
            emit(CreateProgressEvent {
                phase: "create".to_string(), username: detail.username.clone(),
                status: if detail.success { "success".to_string() } else { "failed".to_string() },
                message: detail.message.clone(), current: i + 1, total,
            });
        }

        ldap.unbind().await.ok();
        Ok(BatchResult::from_details(details))
    }

    /// 从域控 schema 拉取 user 类（含继承链 person/organizationalPerson/top）的全部属性名，
    /// 用于动态生成统一模板：模板含全量字段，用户填哪列写哪列，空列跳过
    pub async fn get_user_schema_attributes(&self) -> Result<Vec<String>, String> {
        let (mut ldap, _) = self.connect().await?;

        // 1. RootDSE 获取架构命名上下文
        let res = ldap.search("", Scope::Base, "(objectClass=*)", vec!["schemaNamingContext"])
            .await.map_err(|e| format!("查询架构失败: {}", e))?;
        let (entries, _) = res.success().map_err(|e| format!("查询架构失败: {}", e))?;
        let root = entries.into_iter().next().ok_or_else(|| "未获取到 RootDSE".to_string())?;
        let root = SearchEntry::construct(root);
        let schema_nc = root.attrs.get("schemaNamingContext")
            .and_then(|v| v.first()).cloned()
            .ok_or_else(|| "未获取到架构命名上下文".to_string())?;

        // 2. 沿继承链向上（user → person → organizationalPerson → top）收集全部可设属性；
        // 同时收集 user 的辅助类（auxiliaryClass，如 UNIX 扩展的 posixAccount/shadowAccount，
        // uidNumber/gidNumber/loginShell 等属性挂在这些类上）及其继承链
        // 类在 schema 容器内的 CN 与显示名不同（如 CN=Class-Person），需用 lDAPDisplayName 搜索定位
        let mut names: HashSet<String> = HashSet::new();
        let mut queue: Vec<String> = vec!["user".to_string()];
        let mut visited: HashSet<String> = HashSet::new();
        while let Some(start) = queue.pop() {
            if !visited.insert(start.to_ascii_lowercase()) {
                continue;
            }
            let mut class = start.clone();
            loop {
                let filter = format!("(&(objectClass=classSchema)(lDAPDisplayName={}))", ldap_escape(&class));
                let res = ldap.search(&schema_nc, Scope::OneLevel, &filter,
                    vec!["mayContain", "systemMayContain", "mustContain", "systemMustContain", "subClassOf", "auxiliaryClass"])
                    .await.map_err(|e| format!("查询架构类失败: {}", e))?;
                let (entries, _) = res.success().map_err(|e| format!("查询架构类失败: {}", e))?;
                let entry = match entries.into_iter().next() {
                    Some(e) => SearchEntry::construct(e),
                    None => break,
                };
                for key in ["mayContain", "systemMayContain", "mustContain", "systemMustContain"] {
                    if let Some(vals) = entry.attrs.get(key) {
                        for v in vals { names.insert(v.clone()); }
                    }
                }
                // 仅对起点类（user）展开其辅助类，避免递归收集无关类
                if class.eq_ignore_ascii_case(&start) {
                    if let Some(aux) = entry.attrs.get("auxiliaryClass") {
                        for a in aux { queue.push(a.clone()); }
                    }
                }
                match entry.attrs.get("subClassOf").and_then(|v| v.first()) {
                    Some(parent) if !parent.eq_ignore_ascii_case("top") => class = parent.clone(),
                    _ => break,
                }
            }
        }

        // 3. 过滤系统/只读/危险属性（与 create 跳过清单一致）与内部前缀，按名称排序
        let skip: HashSet<&str> = [
            "objectclass", "objectcategory", "objectguid", "objectsid", "name", "cn",
            "samaccountname", "userprincipalname", "displayname", "instancetype",
            "whencreated", "whenchanged", "usncreated", "usnchanged", "usnlastobjrem",
            "unicodepwd", "lmpassword", "ntpassword", "dscorepropagationdata",
            "replpropertymetadata", "replugtofdvector", "priorsettime", "priorparent",
            "isdeleted", "isrecycled", "lastknownparent", "msds-principalname",
            "msds-userpasswordexpirytimecomputed", "tokengroups", "memberof",
            "primarygroupid", "useraccountcontrol", "distinguishedname",
        ].into_iter().collect();
        let mut result: Vec<String> = names.into_iter()
            .filter(|n| {
                let lk = n.to_ascii_lowercase();
                !skip.contains(lk.as_str())
                    && !lk.starts_with("msds-")
                    && !lk.starts_with("ms-")
            })
            .collect();
        result.sort_by_key(|s| s.to_ascii_lowercase());

        ldap.unbind().await.ok();
        Ok(result)
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

    /// 启用/禁用账户：读当前 UAC 后置位/清位 ACCOUNTDISABLE(0x2)
    pub async fn set_account_enabled(&self, user_dn: &str, enable: bool) -> Result<(), String> {
        let (mut ldap, _) = self.connect().await?;

        let cur = Self::get_attr_value(&mut ldap, user_dn, "userAccountControl").await?;
        let uac: u32 = cur.parse().map_err(|_| "读取账户控制位失败: 非法的 userAccountControl".to_string())?;
        let new_uac = if enable { uac & !2 } else { uac | 2 };
        if new_uac == uac {
            return Err(if enable { "账户已是启用状态".to_string() } else { "账户已是禁用状态".to_string() });
        }

        let mut vals: HashSet<Vec<u8>> = HashSet::new();
        vals.insert(new_uac.to_string().into_bytes());
        ldap.modify(user_dn, vec![ldap3::Mod::Replace(b"userAccountControl".to_vec(), vals)])
            .await
            .map_err(|e| format!("{}账户失败: {}", if enable { "启用" } else { "禁用" }, e))?
            .success()
            .map_err(|e| format!("{}账户失败: {}", if enable { "启用" } else { "禁用" }, e))?;

        ldap.unbind().await.ok();
        Ok(())
    }

    /// 不允许在属性编辑器中修改的属性（系统/危险属性，大小写不敏感）
    const EDIT_SKIP_ATTRS: &'static [&'static str] = &[
        "objectclass", "objectcategory", "objectguid", "objectsid", "instancetype",
        "name", "cn", "samaccountname", "useraccountcontrol", "unicodepwd", "lmpassword",
        "whencreated", "whenchanged", "usncreated", "usnchanged", "usnlastobjrem",
        "dscorepropagationdata", "memberof", "primarygroupid", "lastlogon", "lastlogontimestamp",
        "lastlogoff", "badpwdcount", "badpasswordtime", "pwdlastset", "accountexpires",
        "msds-supportedencryptiontypes", "logoncount", "iscriticalsystemobject",
    ];

    /// 读取用户全部可展示属性（过滤系统/二进制属性），供属性编辑器回显
    pub async fn get_user_detail(&self, user_dn: &str) -> Result<HashMap<String, String>, String> {
        let (mut ldap, _) = self.connect().await?;
        let (rs, _rc) = ldap.search(user_dn, Scope::Base, "(objectClass=*)", vec!["*"])
            .await
            .map_err(|e| format!("读取用户属性失败: {}", e))?
            .success()
            .map_err(|e| format!("读取用户属性失败: {}", e))?;

        let entry = rs.into_iter().next().ok_or_else(|| "用户不存在".to_string())?;
        let se = SearchEntry::construct(entry);
        let mut out: HashMap<String, String> = HashMap::new();
        for (k, v) in se.attrs {
            let lk = k.to_ascii_lowercase();
            if Self::EDIT_SKIP_ATTRS.contains(&lk.as_str()) || lk.starts_with("msds-") {
                continue;
            }
            // 二进制属性经 lossy 转换会出现替换字符，直接跳过
            let first = match v.first() {
                Some(s) if !s.contains('\u{FFFD}') => s,
                _ => continue,
            };
            out.insert(k, first.clone());
        }
        ldap.unbind().await.ok();
        Ok(out)
    }

    /// 修改单个用户属性：值为空 = 删除该属性，非空 = 覆盖写入
    pub async fn modify_user_attributes(&self, user_dn: &str, attrs: &HashMap<String, String>) -> Result<u32, String> {
        if attrs.is_empty() {
            return Err("没有需要修改的属性".to_string());
        }
        let (mut ldap, _) = self.connect().await?;

        let mut mods: Vec<ldap3::Mod<Vec<u8>>> = Vec::new();
        let mut applied = 0u32;
        for (k, v) in attrs {
            let lk = k.to_ascii_lowercase();
            if Self::EDIT_SKIP_ATTRS.contains(&lk.as_str()) || lk.starts_with("msds-") {
                continue;
            }
            let v = v.trim();
            if v.is_empty() {
                // 仅当属性当前有值时才删除，否则 AD 报 noSuchAttribute
                let cur = Self::get_attr_value(&mut ldap, user_dn, k).await.unwrap_or_default();
                if !cur.is_empty() {
                    mods.push(ldap3::Mod::Delete(k.as_bytes().to_vec(), HashSet::new()));
                    applied += 1;
                }
            } else {
                let mut vals: HashSet<Vec<u8>> = HashSet::new();
                vals.insert(v.as_bytes().to_vec());
                mods.push(ldap3::Mod::Replace(k.as_bytes().to_vec(), vals));
                applied += 1;
            }
        }
        if mods.is_empty() {
            return Err("没有可应用的属性修改（均为系统保护属性）".to_string());
        }

        ldap.modify(user_dn, mods)
            .await
            .map_err(|e| format!("修改属性失败: {}", e))?
            .success()
            .map_err(|e| format!("修改属性失败: {}", e))?;

        ldap.unbind().await.ok();
        Ok(applied)
    }
}
