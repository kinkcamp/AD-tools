import React, { useCallback, useState } from 'react'
import { message } from 'antd'
import type { ParsedRecord } from '../types'

interface UploadZoneProps {
  onFileSelect?: (file: File) => void
  onFileParsed?: (records: ParsedRecord[]) => void
  accept?: string
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, onFileParsed, accept = '.csv,.xlsx,.xls' }) => {
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name)
    onFileSelect?.(file)

    if (onFileParsed) {
      setParsing(true)
      try {
        // In Tauri env, use the Rust file parser via IPC
        // For now, parse client-side as fallback
        const text = await file.text()
        if (file.name.endsWith('.csv')) {
          const lines = text.trim().split('\n')
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
          const records: ParsedRecord[] = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
            const fields: Record<string, string> = {}
            headers.forEach((h, i) => { fields[h] = values[i] || '' })
            return { fields }
          })
          onFileParsed(records)
          message.success(`已解析 ${records.length} 条记录`)
        } else {
          message.info('Excel 文件解析需要 Tauri 后端支持')
        }
      } catch (err) {
        message.error(`文件解析失败: ${err}`)
      } finally {
        setParsing(false)
      }
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
