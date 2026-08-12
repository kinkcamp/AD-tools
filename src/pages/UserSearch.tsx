import React from 'react'
import { Table, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import StatsRow from '../components/StatsRow'

interface UserRecord {
  key: string
  sAMAccountName: string
  displayName: string
  mail: string
  department: string
  status: 'active' | 'disabled' | 'locked'
  lastLogin: string
}

const mockData: UserRecord[] = [
  { key: '1', sAMAccountName: 'zhangsan', displayName: '张三', mail: 'zhangsan@company.com', department: '技术部', status: 'active', lastLogin: '2026-08-10 09:15' },
  { key: '2', sAMAccountName: 'zhangwei', displayName: '张伟', mail: 'zhangwei@company.com', department: '销售部', status: 'active', lastLogin: '2026-08-09 14:22' },
  { key: '3', sAMAccountName: 'zhangli', displayName: '张丽', mail: 'zhangli@company.com', department: '人事部', status: 'disabled', lastLogin: '2026-07-15 10:30' },
  { key: '4', sAMAccountName: 'zhangming', displayName: '张明', mail: 'zhangming@company.com', department: '财务部', status: 'active', lastLogin: '2026-08-11 08:45' },
  { key: '5', sAMAccountName: 'zhanghua', displayName: '张华', mail: 'zhanghua@company.com', department: '技术部', status: 'locked', lastLogin: '2026-08-08 16:50' },
]

const statusMap = {
  active: { label: '活跃', bg: '#f0fdf4', color: '#16a34a' },
  disabled: { label: '已禁用', bg: '#fef2f2', color: '#dc2626' },
  locked: { label: '已锁定', bg: '#fffbeb', color: '#d97706' },
}

const columns: ColumnsType<UserRecord> = [
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
    title: '邮箱',
    dataIndex: 'mail',
    key: 'mail',
  },
  {
    title: '部门',
    dataIndex: 'department',
    key: 'department',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: 'active' | 'disabled' | 'locked') => {
      const s = statusMap[status]
      return (
        <span style={{
          background: s.bg, color: s.color,
          padding: '2px 8px', borderRadius: 10,
          fontSize: 10, fontWeight: 500,
        }}>
          {s.label}
        </span>
      )
    },
  },
  {
    title: '最后登录',
    dataIndex: 'lastLogin',
    key: 'lastLogin',
    render: (text: string) => <span style={{ color: '#999', fontSize: 11 }}>{text}</span>,
  },
]

const UserSearch: React.FC = () => (
  <>
    <TopBar
      title="搜索用户"
      actions={
        <>
          <Button size="small">导出</Button>
          <Button size="small" danger>批量删除</Button>
        </>
      }
    />
    <SearchBar />
    <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
      <StatsRow items={[
        { label: '搜索结果', value: 128 },
        { label: '活跃', value: 120 },
        { label: '已禁用', value: 5 },
        { label: '已锁定', value: 3 },
      ]} />
      <Table
        columns={columns}
        dataSource={mockData}
        size="small"
        rowSelection={{ type: 'checkbox' }}
        pagination={{
          pageSize: 5,
          showTotal: (total, range) => `显示 ${range[0]}-${range[1]} / 共 ${total} 条`,
          size: 'small',
        }}
        style={{ fontSize: 12 }}
      />
    </div>
  </>
)

export default UserSearch
