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
  ldapHost: string
  ldapPort: number
  baseDN: string
  bindDN: string
  bindPassword: string
  sslEnabled: boolean
  startTls: boolean
  verifyCert: boolean
  caCertPath: string
  ldapVersion: string
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
