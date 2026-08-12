import React, { useCallback } from 'react'

interface UploadZoneProps {
  onFileSelect?: (file: File) => void
  accept?: string
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, accept = '.csv,.xlsx,.xls' }) => {
  const handleClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) onFileSelect?.(file)
    }
    input.click()
  }, [onFileSelect, accept])

  return (
    <div onClick={handleClick} style={{
      border: '1.5px dashed #e0e0e0', borderRadius: 10, padding: 32,
      textAlign: 'center', cursor: 'pointer', marginBottom: 16, transition: 'all 0.15s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.background = '#fafafa' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.5 }}>📁</div>
      <div style={{ fontSize: 13, color: '#333', marginBottom: 4, fontWeight: 500 }}>拖拽文件到此处，或点击选择</div>
      <div style={{ fontSize: 11, color: '#999' }}>支持 CSV / Excel，最大 10MB</div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
        {['.csv', '.xlsx', '.xls'].map((fmt) => (
          <span key={fmt} style={{ background: '#f5f5f5', color: '#999', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 500 }}>{fmt}</span>
        ))}
      </div>
    </div>
  )
}

export default UploadZone
