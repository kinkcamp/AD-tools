import { invoke } from '@tauri-apps/api/core'
import type {
  ADUser, AppConfig, BatchPasswordItem, BatchResult,
  LogEntry, NewUserSpec, ParseResult,
} from '../types'

export const tauriService = {
  // Config
  getConfig: () => invoke<AppConfig>('get_config'),
  saveConfig: (cfg: AppConfig) => invoke<void>('save_config_cmd', { cfg }),
  testConnection: (cfg: AppConfig) => invoke<string>('test_connection', { cfg }),
  // 从域控 schema 拉取 user 类全部可写属性（动态生成模板字段）
  getUserAttributes: (cfg: AppConfig) => invoke<string[]>('get_user_attributes', { cfg }),

  // Users
  searchUsers: (cfg: AppConfig, keyword: string) =>
    invoke<ADUser[]>('search_users', { cfg, keyword }),
  listUsers: (cfg: AppConfig) => invoke<ADUser[]>('list_users', { cfg }),
  changePassword: (cfg: AppConfig, userDn: string, newPassword: string, forceChange: boolean) =>
    invoke<void>('change_password', { cfg, userDn, newPassword, forceChange }),
  deleteUser: (cfg: AppConfig, userDn: string) =>
    invoke<void>('delete_user', { cfg, userDn }),
  // 启用/禁用账户（UAC 置位）
  setAccountEnabled: (cfg: AppConfig, userDn: string, enable: boolean) =>
    invoke<void>('set_account_enabled', { cfg, userDn, enable }),
  // 单用户属性读取/修改（右键菜单的属性编辑器）
  getUserDetail: (cfg: AppConfig, userDn: string) =>
    invoke<Record<string, string>>('get_user_detail', { cfg, userDn }),
  modifyUserAttributes: (cfg: AppConfig, userDn: string, attrs: Record<string, string>) =>
    invoke<number>('modify_user_attributes', { cfg, userDn, attrs }),

  // Batch operations
  batchCreateUsers: (cfg: AppConfig, users: NewUserSpec[]) =>
    invoke<BatchResult>('batch_create_users', { cfg, users }),
  batchChangePasswords: (cfg: AppConfig, items: BatchPasswordItem[]) =>
    invoke<BatchResult>('batch_change_passwords', { cfg, items }),
  batchAddToGroup: (cfg: AppConfig, usernames: string[], groups: string[]) =>
    invoke<BatchResult>('batch_add_to_group', { cfg, usernames, groups }),
  batchModifyAttributes: (
    cfg: AppConfig,
    usernames: string[],
    mods: Record<string, string>,
    perUserValues: Record<string, Record<string, string>>,
    append: boolean,
  ) => invoke<BatchResult>('batch_modify_attributes', { cfg, usernames, mods, perUserValues, append }),

  // Operation logs
  getOperationLogs: (limit = 500) => invoke<LogEntry[]>('get_operation_logs', { limit }),

  // File parsing
  parseFile: (path: string) => invoke<ParseResult>('parse_file', { path }),
  generateTemplate: (format: string, path: string) =>
    invoke<void>('generate_template', { format, path }),
}
