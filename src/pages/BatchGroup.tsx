import React, { useState } from 'react'
import { Table, Button, Input, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import UploadZone from '../components/UploadZone'
import type { ParsedRecord } from '../types'

interface GroupRecord {
  key: string
  index: number
  sAMAccountName: string
  displayName: string
  currentGroups: string
  action: 'exists' | 'will_join'
}

const BatchGroup: React.FC = () => {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [records, setRecords] = useState<GroupRecord[]>([])

  const removeGroup = (group: string) => {
    setSelectedGroups(selectedGroups.filter((g) => g !== group))
  }

  const addGroup = () => {
    if (inputValue && !selectedGroups.includes(inputValue)) {
      setSelectedGroups([...selectedGroups, inputValue])
      setInputValue('')
    }
  }

  const handleFileParsed = (parsedRecords: ParsedRecord[]) => {
    const mapped: GroupRecord[] = parsedRecords.map((r, i) => ({
      key: String(i),
      index: i + 1,
      sAMAccountName: r.fields['sAMAccountName'] || '',
      displayName: r.fields['displayName'] || '',
      currentGroups: r.fields['memberOf'] || '—',
      action: 'will_join' as const,
    }))
    setRecords(mapped)
  }

  const handleConfirm = () => {
    message.info('加入组功能将在连接 AD 后可用')
  }

  const columns: ColumnsType<GroupRecord> = [
    { title: '#', dataIndex: 'index', key: 'index', width: 50 },
    {
      title: '用户名', dataIndex: 'sAMAccountName', key: 'sAMAccountName',
      render: (text: string) => <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{text}</span>,
    },
    { title: '姓名', dataIndex: 'displayName', key: 'displayName' },
    {
      title: '当前所属组', dataIndex: 'currentGroups', key: 'currentGroups',
      render: (text: string) => <span style={{ color: '#999', fontSize: 11 }}>{text}</span>,
    },
    {
      title: '操作', dataIndex: 'action', key: 'action',
      render: (action: 'exists' | 'will_join') => {
        const color = action === 'exists' ? '#d97706' : '#16a34a'
        const label = action === 'exists' ? '已在组' : '将加入'
        return <span style={{ color, fontSize: 11, fontWeight: 500 }}>{label}</span>
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
              placeholder="输入组名后回车"
              style={{ width: 180 }}
              size="small"
            />
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
          </div>
        </div>

        <UploadZone onFileParsed={handleFileParsed} />

        {records.length > 0 && (
          <>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#666' }}>已解析 {records.length} 个用户</span>
              <Button size="small" type="primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} onClick={handleConfirm}>确认执行</Button>
            </div>

            <Table
              columns={columns}
              dataSource={records}
              size="small"
              pagination={false}
              style={{ fontSize: 12 }}
            />
          </>
        )}
      </div>
    </>
  )
}

export default BatchGroup
