export interface ADUser {
  dn: string
  sAMAccountName: string
  displayName: string
  mail: string
  department: string
  status: 'active' | 'disabled' | 'locked'
  lastLogin: string
  uidNumber: string
  gidNumber: string
}

export interface AppConfig {
  server: string
  domain: string
  username: string
  password: string
  insecureTls?: boolean
}

export interface BatchResultItem {
  username: string
  success: boolean
  message: string
}

export interface BatchResult {
  total: number
  success: number
  failed: number
  details: BatchResultItem[]
}

// 批量创建实时进度事件（后端 batch-create-progress 事件负载）
export interface CreateProgressEvent {
  phase: 'check' | 'create'
  username: string
  status: 'checking' | 'creating' | 'success' | 'failed'
  message: string
  current: number
  total: number
}

export interface NewUserSpec {
  sAMAccountName: string
  displayName: string
  ou: string
  password: string
  attributes: Record<string, string>
}

export interface BatchPasswordItem {
  sAMAccountName: string
  password: string
  forceChange: boolean
}

export interface LogEntry {
  time: string
  operation: string
  target: string
  operator: string
  status: 'success' | 'failed' | 'partial'
  detail: string
}

export interface ParsedRecord {
  fields: Record<string, string>
}

export interface ParseResult {
  records: ParsedRecord[]
  headers: string[]
  errors: string[]
  warnings: string[]
}
