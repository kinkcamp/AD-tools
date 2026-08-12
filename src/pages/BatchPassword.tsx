import React, { useState } from 'react'
import { Select, Input, Checkbox } from 'antd'
import TopBar from '../components/TopBar'
import UploadZone from '../components/UploadZone'

interface LogLine {
  time: string
  text: string
  color: string
}

const BatchPassword: React.FC = () => {
  const [mode, setMode] = useState('file')
  const [length, setLength] = useState(12)
  const [forceChange, setForceChange] = useState(true)
  const [exportList, setExportList] = useState(false)
  const [logLines] = useState<LogLine[]>([])
  const [progress] = useState<{ processed: number; total: number; success: number; failed: number } | null>(null)

  return (
    <>
      <TopBar title="批量修改密码" />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>密码策略</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>密码模式</span>
              <Select value={mode} onChange={setMode} style={{ width: 140 }} size="small" options={[
                { value: 'file', label: '文件中指定' },
                { value: 'uniform', label: '统一密码' },
                { value: 'auto', label: '自动生成' },
              ]} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>密码长度</span>
              <Input
                type="number"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                style={{ width: 80 }}
                size="small"
              />
            </div>
            <Checkbox checked={forceChange} onChange={(e) => setForceChange(e.target.checked)}>
              <span style={{ fontSize: 11 }}>强制下次登录修改</span>
            </Checkbox>
            <Checkbox checked={exportList} onChange={(e) => setExportList(e.target.checked)}>
              <span style={{ fontSize: 11 }}>导出密码清单</span>
            </Checkbox>
          </div>
        </div>

        <UploadZone />

        {progress && (
          <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>
                已处理 {progress.processed} / {progress.total}
              </span>
              <span style={{ fontSize: 11 }}>
                <span style={{ color: '#16a34a' }}>成功 {progress.success}</span>
                {' · '}
                <span style={{ color: '#dc2626' }}>失败 {progress.failed}</span>
              </span>
            </div>
            <div style={{ background: '#f0f0f0', borderRadius: 2, height: 4, overflow: 'hidden' }}>
              <div style={{
                background: '#1a1a1a', height: '100%',
                width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%`,
                borderRadius: 2, transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )}

        {logLines.length > 0 && (
          <div style={{
            background: '#fafafa', borderRadius: 8, padding: 12,
            maxHeight: 130, overflowY: 'auto',
            fontFamily: 'monospace', fontSize: 11,
          }}>
            {logLines.map((line, i) => (
              <div key={i} style={{ marginBottom: 2 }}>
                <span style={{ color: '#ccc' }}>[{line.time}]</span>{' '}
                <span style={{ color: line.color }}>{line.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default BatchPassword
