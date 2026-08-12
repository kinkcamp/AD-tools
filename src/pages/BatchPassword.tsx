import React, { useState } from 'react'
import { Select, Input, Checkbox } from 'antd'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import UploadZone from '../components/UploadZone'

const logLines = [
  { time: '14:32:01', text: '开始处理 zhangsan...', color: '#666' },
  { time: '14:32:02', text: 'zhangsan 密码修改成功', color: '#16a34a' },
  { time: '14:32:03', text: '开始处理 zhangwei...', color: '#666' },
  { time: '14:32:04', text: 'zhangwei 密码修改成功', color: '#16a34a' },
  { time: '14:32:05', text: '开始处理 zhangli...', color: '#666' },
  { time: '14:32:06', text: 'zhangli 密码修改失败: 密码不符合复杂度要求', color: '#dc2626' },
  { time: '14:32:07', text: '开始处理 zhangming...', color: '#666' },
  { time: '14:32:08', text: 'zhangming 密码修改成功', color: '#16a34a' },
]

const BatchPassword: React.FC = () => {
  const [mode, setMode] = useState('file')
  const [length, setLength] = useState(12)
  const [forceChange, setForceChange] = useState(true)
  const [exportList, setExportList] = useState(false)

  return (
    <>
      <TopBar title="批量修改密码" />
      <SearchBar />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        {/* Form card */}
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

        {/* Progress card */}
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>已处理 18 / 25</span>
            <span style={{ fontSize: 11 }}>
              <span style={{ color: '#16a34a' }}>成功 17</span> · <span style={{ color: '#dc2626' }}>失败 1</span>
            </span>
          </div>
          <div style={{ background: '#f0f0f0', borderRadius: 2, height: 4, overflow: 'hidden' }}>
            <div style={{ background: '#1a1a1a', height: '100%', width: '72%', borderRadius: 2 }} />
          </div>
        </div>

        {/* Log panel */}
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
      </div>
    </>
  )
}

export default BatchPassword
