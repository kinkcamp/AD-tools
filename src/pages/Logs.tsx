import React, { useCallback, useEffect, useState } from 'react'
import { Table, Tag, Button, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import StatsRow from '../components/StatsRow'
import { tauriService } from '../services/tauri'
import type { LogEntry } from '../types'

const statusConfig: Record<string, { color: string; label: string }> = {
  success: { color: '#16a34a', label: '成功' },
  failed: { color: '#e54d4d', label: '失败' },
  partial: { color: '#d97706', label: '部分成功' },
}

const columns: ColumnsType<LogEntry> = [
  {
    title: '时间', dataIndex: 'time', key: 'time', width: 170,
    render: (text: string) => <span style={{ color: '#666', fontSize: 11, fontFamily: 'monospace' }}>{text}</span>,
  },
  {
    title: '操作类型', dataIndex: 'operation', key: 'operation', width: 160,
    render: (text: string) => <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{text}</span>,
  },
  { title: '操作对象', dataIndex: 'target', key: 'target', width: 220, ellipsis: true },
  { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
  {
    title: '状态', dataIndex: 'status', key: 'status', width: 100,
    render: (status: string) => {
      const cfg = statusConfig[status] || { color: '#999', label: status }
      return (
        <Tag color={cfg.color} style={{ borderRadius: 10, fontSize: 10, border: 'none' }}>
          {cfg.label}
        </Tag>
      )
    },
  },
  {
    title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true,
    render: (text: string) => <span style={{ color: '#888', fontSize: 11 }}>{text || '—'}</span>,
  },
]

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const entries = await tauriService.getOperationLogs(500)
      setLogs(entries)
    } catch (err) {
      message.error(`加载日志失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const today = new Date().toISOString().slice(0, 10)
  const todayLogs = logs.filter(l => l.time.startsWith(today))
  const successCount = todayLogs.filter(l => l.status === 'success').length
  const partialCount = todayLogs.filter(l => l.status === 'partial').length
  const failedCount = todayLogs.filter(l => l.status === 'failed').length

  return (
    <>
      <TopBar
        title="操作日志"
        actions={<Button size="small" onClick={loadLogs} loading={loading}>刷新</Button>}
      />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        <StatsRow items={[
          { label: '今日操作', value: todayLogs.length },
          { label: '成功', value: successCount },
          { label: '部分成功', value: partialCount },
          { label: '失败', value: failedCount },
        ]} />
        <Table
          rowKey={(r) => `${r.time}_${r.operation}_${r.target}`}
          columns={columns}
          dataSource={logs}
          loading={loading}
          size="small"
          locale={{ emptyText: '暂无操作日志' }}
          pagination={logs.length > 0 ? {
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
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
