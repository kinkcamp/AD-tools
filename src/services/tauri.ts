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

  // Users
  searchUsers: (cfg: AppConfig, keyword: string, ouFilter: string) =>
    invoke<ADUser[]>('search_users', { cfg, keyword, ouFilter }),
  changePassword: (cfg: AppConfig, userDn: string, newPassword: string, forceChange: boolean) =>
    invoke<void>('change_password', { cfg, userDn, newPassword, forceChange }),
  deleteUser: (cfg: AppConfig, userDn: string) =>
    invoke<void>('delete_user', { cfg, userDn }),

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
