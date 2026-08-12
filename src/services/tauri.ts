import { invoke } from '@tauri-apps/api/core'
import type { ADUser, AppConfig, ParseResult } from '../types'

export const tauriService = {
  // Config
  getConfig: () => invoke<AppConfig>('get_config'),
  saveConfig: (config: AppConfig) => invoke<void>('save_config_cmd', { config }),
  testConnection: (config: AppConfig) => invoke<string>('test_connection', { config }),

  // Users
  searchUsers: (config: AppConfig, keyword: string, ouFilter: string) =>
    invoke<ADUser[]>('search_users', { config, keyword, ouFilter }),
  changePassword: (config: AppConfig, userDn: string, newPassword: string, forceChange: boolean) =>
    invoke<void>('change_password', { config, userDn, newPassword, forceChange }),
  deleteUser: (config: AppConfig, userDn: string) =>
    invoke<void>('delete_user', { config, userDn }),

  // File parsing
  parseFile: (path: string) => invoke<ParseResult>('parse_file', { path }),
  generateTemplate: (format: string, path: string) =>
    invoke<void>('generate_template', { format, path }),
}
