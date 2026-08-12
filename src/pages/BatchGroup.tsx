import React, { useState } from 'react'
import { Table, Button, Input, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import UploadZone from '../components/UploadZone'

interface GroupRecord {
  key: string
  index: number
  sAMAccountName: string
  displayName: string
  currentGroups: string
  action: 'exists' | 'will_join'
}

const mockData: GroupRecord[] = [
  { key: '1', index: 1, sAMAccountName: 'zhangsan', displayName: '张三', currentGroups: 'VPN-Users, All-Staff', action: 'exists' },
  { key: '2', index: 2, sAMAccountName: 'wangwu', displayName: '王五', currentGroups: 'All-Staff', action: 'will_join' },
  { key: '3', index: 3, sAMAccountName: 'zhaoliu', displayName: '赵六', currentGroups: 'Developers', action: 'will_join' },
]

const actionMap = {
  exists: { label: '已在组', color: '#d97706' },
  will_join: { label: '将加入', color: '#16a34a' },
}

const BatchGroup: React.FC = () => {
  const [selectedGroups, setSelectedGroups] = useState<string[]>(['VPN-Users', 'All-Staff'])
  const [inputValue, setInputValue] = useState('')

  const removeGroup = (group: string) => {
    setSelectedGroups(selectedGroups.filter((g) => g !== group))
  }

  const addGroup = () => {
    if (inputValue && !selectedGroups.includes(inputValue)) {
      setSelectedGroups([...selectedGroups, inputValue])
      setInputValue('')
    }
  }

  const columns: ColumnsType<GroupRecord> = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 50,
    },
    {
      title: '用户名',
      dataIndex: 'sAMAccountName',
      key: 'sAMAccountName',
      render: (text: string) => <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{text}</span>,
    },
    {
      title: '姓名',
      dataIndex: 'displayName',
      key: 'displayName',
    },
    {
      title: '当前所属组',
      dataIndex: 'currentGroups',
      key: 'currentGroups',
      render: (text: string) => <span style={{ color: '#999', fontSize: 11 }}>{text}</span>,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (action: 'exists' | 'will_join') => {
        const a = actionMap[action]
        return <span style={{ color: a.color, fontSize: 11, fontWeight: 500 }}>{a.label}</span>
      },
    },
  ]

  return (
    <>
      <TopBar title="批量加入组" />
      <SearchBar />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        {/* Form card */}
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

        <UploadZone />

        {/* Preview info */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#666' }}>target_users.csv — 15 个用户</span>
          <Button size="small" type="primary" style={{ background: '#16a34a', borderColor: '#16a34a' }}>确认执行</Button>
        </div>

        <Table
          columns={columns}
          dataSource={mockData}
          size="small"
          pagination={false}
          style={{ fontSize: 12 }}
        />
      </div>
    </>
  )
}

export default BatchGroup
