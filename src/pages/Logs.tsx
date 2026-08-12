import React from 'react'
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

const mockLogs: LogRecord[] = [
  { key: '1', time: '2026-08-12 14:32:05', operation: '批量创建', target: '15 个用户', operator: 'admin', status: 'success', detail: '全部创建成功' },
  { key: '2', time: '2026-08-12 13:10:22', operation: '修改密码', target: 'zhangsan', operator: 'admin', status: 'success', detail: '密码已更新，要求下次登录修改' },
  { key: '3', time: '2026-08-12 11:45:18', operation: '批量改密', target: '8 个用户', operator: 'admin', status: 'partial', detail: '7 成功 / 1 失败' },
  { key: '4', time: '2026-08-12 10:20:00', operation: '加入组', target: 'IT-Staff → 12 个用户', operator: 'admin', status: 'success', detail: '全部加入成功' },
  { key: '5', time: '2026-08-11 17:55:33', operation: '修改属性', target: '20 个用户', operator: 'admin', status: 'failed', detail: 'LDAP 连接超时' },
  { key: '6', time: '2026-08-11 16:30:10', operation: '删除用户', target: 'testuser01', operator: 'admin', status: 'success', detail: '用户已删除' },
  { key: '7', time: '2026-08-11 15:08:45', operation: '批量创建', target: '30 个用户', operator: 'admin', status: 'partial', detail: '28 成功 / 2 失败（用户名重复）' },
  { key: '8', time: '2026-08-11 09:22:11', operation: '搜索用户', target: 'keyword: zhang', operator: 'admin', status: 'success', detail: '返回 128 条结果' },
]

const statusConfig: Record<string, { color: string; label: string }> = {
  success: { color: '#16a34a', label: '成功' },
  failed: { color: '#e54d4d', label: '失败' },
  partial: { color: '#d97706', label: '部分成功' },
}

const columns: ColumnsType<LogRecord> = [
  {
    title: '时间',
    dataIndex: 'time',
    key: 'time',
    width: 170,
    render: (text: string) => <span style={{ color: '#666', fontSize: 11, fontFamily: 'monospace' }}>{text}</span>,
  },
  {
    title: '操作类型',
    dataIndex: 'operation',
    key: 'operation',
    width: 100,
    render: (text: string) => <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{text}</span>,
  },
  {
    title: '操作对象',
    dataIndex: 'target',
    key: 'target',
    width: 180,
  },
  {
    title: '操作人',
    dataIndex: 'operator',
    key: 'operator',
    width: 80,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
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
    title: '详情',
    dataIndex: 'detail',
    key: 'detail',
    ellipsis: true,
    render: (text: string) => <span style={{ color: '#888', fontSize: 11 }}>{text}</span>,
  },
]

const Logs: React.FC = () => (
  <>
    <TopBar title="操作日志" />
    <SearchBar />
    <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
      <StatsRow items={[
        { label: '今日操作', value: 8 },
        { label: '成功', value: 5 },
        { label: '部分成功', value: 2 },
        { label: '失败', value: 1 },
      ]} />
      <Table
        columns={columns}
        dataSource={mockLogs}
        size="small"
        pagination={{
          pageSize: 10,
          showTotal: (total, range) => `显示 ${range[0]}-${range[1]} / 共 ${total} 条`,
          size: 'small',
        }}
        style={{ fontSize: 12 }}
      />
    </div>
  </>
)

export default Logs
