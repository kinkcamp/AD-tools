import React, { useCallback, useState } from 'react'
import { message } from 'antd'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ParsedRecord } from '../types'

interface UploadZoneProps {
  onFileSelect?: (file: File) => void
  onFileParsed?: (records: ParsedRecord[]) => void
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
            Object.entries(row).forEach(([k, v]) => { fields[k] = (v ?? '').trim() })
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
            Object.entries(row).forEach(([k, v]) => { fields[String(k).trim()] = String(v).trim() })
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
      onFileParsed(records)
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
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) handleFile(file)
    }
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
