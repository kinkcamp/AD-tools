import { invoke } from '@tauri-apps/api/core'
import type { ADUser, AppConfig, ParseResult } from '../types'

export const tauriService = {
  // Config
  getConfig: () => invoke<AppConfig>('get_config'),
  saveConfig: (cfg: AppConfig) => invoke<void>('save_config_cmd', { cfg }),
  testConnection: (cfg: AppConfig) => invoke<string>('test_connection', { cfg }),

  // Users
  searchUsers: (cfg: AppConfig, keyword: string, ouFilter: string) =>
    invoke<ADUser[]>('search_users', { cfg, keyword, ou_filter: ouFilter }),
  changePassword: (cfg: AppConfig, userDn: string, newPassword: string, forceChange: boolean) =>
    invoke<void>('change_password', { cfg, user_dn: userDn, new_password: newPassword, force_change: forceChange }),
  deleteUser: (cfg: AppConfig, userDn: string) =>
    invoke<void>('delete_user', { cfg, user_dn: userDn }),

  // File parsing
  parseFile: (path: string) => invoke<ParseResult>('parse_file', { path }),
  generateTemplate: (format: string, path: string) =>
    invoke<void>('generate_template', { format, path }),
}
