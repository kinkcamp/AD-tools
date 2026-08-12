import React, { useState } from 'react'
import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import StatsRow from '../components/StatsRow'

interface LogRecord {
  key: string
  time: string
  operation: string
  target: string
  operator: string
  status: 'success' | 'failed' | 'partial'
  detail: string
}

const statusConfig: Record<string, { color: string; label: string }> = {
  success: { color: '#16a34a', label: '成功' },
  failed: { color: '#e54d4d', label: '失败' },
  partial: { color: '#d97706', label: '部分成功' },
}

const columns: ColumnsType<LogRecord> = [
  {
    title: '时间', dataIndex: 'time', key: 'time', width: 170,
    render: (text: string) => <span style={{ color: '#666', fontSize: 11, fontFamily: 'monospace' }}>{text}</span>,
  },
  {
    title: '操作类型', dataIndex: 'operation', key: 'operation', width: 100,
    render: (text: string) => <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{text}</span>,
  },
  { title: '操作对象', dataIndex: 'target', key: 'target', width: 180 },
  { title: '操作人', dataIndex: 'operator', key: 'operator', width: 80 },
  {
    title: '状态', dataIndex: 'status', key: 'status', width: 100,
    render: (status: 'success' | 'failed' | 'partial') => {
      const cfg = statusConfig[status]
      return (
        <Tag color={cfg.color} style={{ borderRadius: 10, fontSize: 10, border: 'none' }}>
          {cfg.label}
        </Tag>
      )
    },
  },
  {
    title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true,
    render: (text: string) => <span style={{ color: '#888', fontSize: 11 }}>{text}</span>,
  },
]

const Logs: React.FC = () => {
  const [logs] = useState<LogRecord[]>([])

  const successCount = logs.filter(l => l.status === 'success').length
  const partialCount = logs.filter(l => l.status === 'partial').length
  const failedCount = logs.filter(l => l.status === 'failed').length

  return (
    <>
      <TopBar title="操作日志" />
      <SearchBar />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        <StatsRow items={[
          { label: '今日操作', value: logs.length },
          { label: '成功', value: successCount },
          { label: '部分成功', value: partialCount },
          { label: '失败', value: failedCount },
        ]} />
        <Table
          columns={columns}
          dataSource={logs}
          size="small"
          locale={{ emptyText: '暂无操作日志' }}
          pagination={logs.length > 0 ? {
            pageSize: 10,
            showTotal: (total, range) => `显示 ${range[0]}-${range[1]} / 共 ${total} 条`,
            size: 'small',
          } : false}
          style={{ fontSize: 12 }}
        />
      </div>
    </>
  )
}

export default Logs
