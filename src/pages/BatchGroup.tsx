import React, { useState } from 'react'
import { Table, Button, Input, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import UploadZone from '../components/UploadZone'
import { tauriService } from '../services/tauri'
import type { BatchResult, ParsedRecord } from '../types'

interface GroupRecord {
  key: string
  index: number
  sAMAccountName: string
  displayName: string
  resultMsg?: string
}

const BatchGroup: React.FC = () => {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [records, setRecords] = useState<GroupRecord[]>([])
  const [fileName, setFileName] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)

  const removeGroup = (group: string) => {
    setSelectedGroups(selectedGroups.filter((g) => g !== group))
  }

  const addGroup = () => {
    const g = inputValue.trim()
    if (g && !selectedGroups.includes(g)) {
      setSelectedGroups([...selectedGroups, g])
      setInputValue('')
    }
  }

  const handleFileParsed = (parsedRecords: ParsedRecord[], name?: string) => {
    const mapped: GroupRecord[] = parsedRecords.map((r, i) => ({
      key: String(i),
      index: i + 1,
      sAMAccountName: r.fields['sAMAccountName'] || '',
      displayName: r.fields['displayName'] || '',
    })).filter(r => r.sAMAccountName)
    if (mapped.length === 0) {
      message.error('文件中没有找到 sAMAccountName 列或无有效数据')
      return
    }
    setRecords(mapped)
    setResult(null)
    if (name) setFileName(name)
  }

  const handleConfirm = async () => {
    if (selectedGroups.length === 0) {
      message.error('请先添加至少一个目标组')
      return
    }
    if (records.length === 0) {
      message.error('请先上传包含用户名的文件')
      return
    }
    try {
      const cfg = await tauriService.getConfig()
      if (!cfg.server || !cfg.domain) {
        message.error('请先在连接设置中配置 AD 服务器')
        return
      }

      setRunning(true)
      const res = await tauriService.batchAddToGroup(
        cfg,
        records.map(r => r.sAMAccountName),
        selectedGroups,
      )
      setResult(res)

      const byName = new Map(res.details.map(d => [d.username, d]))
      setRecords(prev => prev.map(r => {
        const d = byName.get(r.sAMAccountName)
        return d ? { ...r, resultMsg: d.success ? '已加入组' : d.message } : r
      }))

      if (res.failed === 0) message.success(`全部加入成功（${res.success}）`)
      else message.warning(`成功 ${res.success}，失败 ${res.failed}`)
    } catch (err) {
      message.error(`加入组失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunning(false)
    }
  }

  const columns: ColumnsType<GroupRecord> = [
    { title: '#', dataIndex: 'index', key: 'index', width: 50 },
    {
      title: '用户名', dataIndex: 'sAMAccountName', key: 'sAMAccountName',
      render: (text: string) => <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{text}</span>,
    },
    { title: '姓名', dataIndex: 'displayName', key: 'displayName' },
    {
      title: '操作', dataIndex: 'resultMsg', key: 'resultMsg', width: 140,
      render: (text?: string) => {
        if (!text) return <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 500 }}>将加入</span>
        const ok = text === '已加入组'
        return <span style={{ color: ok ? '#16a34a' : '#dc2626', fontSize: 11, fontWeight: 500 }}>{text}</span>
      },
    },
  ]

  return (
    <>
      <TopBar title="批量加入组" />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>目标组</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>选择目标AD组</span>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={addGroup}
              placeholder="输入组名后回车（支持多个组）"
              style={{ width: 220 }}
              size="small"
            />
            <Button size="small" onClick={addGroup} disabled={!inputValue.trim()}>添加</Button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {selectedGroups.map((group) => (
              <Tag
                key={group}
                closable
                onClose={() => removeGroup(group)}
                style={{ fontSize: 11, margin: 0 }}
              >
                {group}
              </Tag>
            ))}
            {selectedGroups.length === 0 && <span style={{ fontSize: 11, color: '#bbb' }}>尚未添加目标组</span>}
          </div>
        </div>

        <UploadZone onFileParsed={handleFileParsed} />

        {records.length > 0 && (
          <>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#666' }}>
                {fileName || '已解析文件'} — {records.length} 个用户
                {result && <> · <span style={{ color: '#16a34a' }}>成功 {result.success}</span> · <span style={{ color: '#dc2626' }}>失败 {result.failed}</span></>}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" onClick={() => { setRecords([]); setFileName(''); setResult(null) }}>重新上传</Button>
                <Button size="small" type="primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} onClick={handleConfirm} loading={running} disabled={!!result}>
                  {result ? '已完成' : '确认执行'}
                </Button>
              </div>
            </div>

            <Table
              columns={columns}
              dataSource={records}
              size="small"
              pagination={records.length > 20 ? { defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], size: 'small' } : false}
              style={{ fontSize: 12 }}
            />
          </>
        )}
      </div>
    </>
  )
}

export default BatchGroup
