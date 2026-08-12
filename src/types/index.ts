export interface ADUser {
  dn: string
  sAMAccountName: string
  displayName: string
  mail: string
  department: string
  status: 'active' | 'disabled' | 'locked'
  lastLogin: string
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
