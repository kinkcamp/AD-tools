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
}

export interface BatchResult {
  total: number
  success: number
  failed: number
  details: { username: string; success: boolean; message: string }[]
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
