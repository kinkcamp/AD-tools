import React, { useCallback, useState } from 'react'
import { message } from 'antd'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ParsedRecord } from '../types'
import { TEMPLATE_HEADERS } from '../utils/template'

// 列名容错：忽略大小写与 BOM，自动归一到模板标准列名（如 samaccountname → sAMAccountName）；
// 同时支持常见中文表头（如 姓名 → displayName），方便直接上传自制名单
const canonicalByKey = new Map(TEMPLATE_HEADERS.map((h) => [h.toLowerCase(), h]))
const ALIAS_MAP: Record<string, string> = {
  '用户名': 'sAMAccountName', '账号': 'sAMAccountName', '帐号': 'sAMAccountName', '登录名': 'sAMAccountName',
  'username': 'sAMAccountName', 'account': 'sAMAccountName', 'login': 'sAMAccountName',
  '姓名': 'displayName', '显示名': 'displayName', '名称': 'displayName', 'name': 'displayName',
  '组织单元': 'ou', '密码': 'password', '初始密码': 'password',
  '邮箱': 'mail', '电子邮件': 'mail', 'email': 'mail',
  '部门': 'department', 'dept': 'department',
  '职位': 'title', '职务': 'title',
  '电话': 'telephoneNumber', '手机': 'telephoneNumber', 'phone': 'telephoneNumber', 'mobile': 'telephoneNumber',
  '描述': 'description', '备注': 'description',
  '名': 'givenName', '姓': 'sn',
}
const normalizeKey = (k: string): string => {
  const clean = k.replace(/^\uFEFF/, '').trim()
  return canonicalByKey.get(clean.toLowerCase()) ?? ALIAS_MAP[clean.toLowerCase()] ?? clean
}

interface UploadZoneProps {
  onFileSelect?: (file: File) => void
  onFileParsed?: (records: ParsedRecord[], fileName?: string) => void
  accept?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, onFileParsed, accept = '.csv,.xlsx,.xls' }) => {
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      message.error('文件大小超过 10MB 限制')
      return
    }
    setFileName(file.name)
    onFileSelect?.(file)

    if (!onFileParsed) return

    setParsing(true)
    try {
      let records: ParsedRecord[] = []

      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text()
        const result = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim(),
        })
        if (result.errors.length > 0 && result.data.length === 0) {
          throw new Error(result.errors[0].message)
        }
        records = result.data
          .filter(row => Object.values(row).some(v => v && v.trim() !== ''))
          .map(row => {
            const fields: Record<string, string> = {}
            Object.entries(row).forEach(([k, v]) => { fields[normalizeKey(k)] = (v ?? '').trim() })
            return { fields }
          })
      } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        if (!sheet) throw new Error('工作簿中没有工作表')
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        records = rows
          .filter(row => Object.values(row).some(v => String(v).trim() !== ''))
          .map(row => {
            const fields: Record<string, string> = {}
            Object.entries(row).forEach(([k, v]) => { fields[normalizeKey(String(k))] = String(v).trim() })
            return { fields }
          })
      } else {
        throw new Error('不支持的文件格式，请使用 CSV 或 Excel')
      }

      if (records.length === 0) {
        message.warning('文件中没有有效数据')
      } else {
        message.success(`已解析 ${records.length} 条记录`)
      }
      onFileParsed(records, file.name)
    } catch (err) {
      message.error(`文件解析失败: ${err}`)
      setFileName('')
    } finally {
      setParsing(false)
    }
  }, [onFileSelect, onFileParsed])

  const handleClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    // 挂到 DOM 上再触发：WKWebView 中未挂载的 input 偶发收不到 change 事件
    document.body.appendChild(input)
    let picked = false
    input.onchange = (e) => {
      picked = true
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) handleFile(file)
      input.remove()
    }
    // 用户取消选择时移除 input，避免 DOM 泄漏
    input.addEventListener('cancel', () => input.remove())
    window.setTimeout(() => { if (!picked && input.isConnected) input.remove() }, 5 * 60 * 1000)
    input.click()
  }, [handleFile, accept])

  return (
    <div onClick={handleClick} style={{
      border: '1.5px dashed #e0e0e0', borderRadius: 10, padding: 32,
      textAlign: 'center', cursor: 'pointer', marginBottom: 16, transition: 'all 0.15s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.background = '#fafafa' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.5 }}>📁</div>
      {fileName ? (
        <div>
          <div style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500, marginBottom: 4 }}>{fileName}</div>
          <div style={{ fontSize: 11, color: parsing ? '#d97706' : '#16a34a' }}>
            {parsing ? '解析中...' : '已加载，点击重新选择'}
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: '#333', marginBottom: 4, fontWeight: 500 }}>拖拽文件到此处，或点击选择</div>
          <div style={{ fontSize: 11, color: '#999' }}>支持 CSV / Excel，最大 10MB</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
            {['.csv', '.xlsx', '.xls'].map((fmt) => (
              <span key={fmt} style={{ background: '#f5f5f5', color: '#999', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 500 }}>{fmt}</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default UploadZone
