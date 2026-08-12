import React from 'react'
import { Table, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import StepsBar from '../components/StepsBar'
import UploadZone from '../components/UploadZone'

interface CreateRecord {
  key: string
  index: number
  sAMAccountName: string
  displayName: string
  ou: string
  mail: string
  status: 'pass' | 'warn'
}

const mockData: CreateRecord[] = [
  { key: '1', index: 1, sAMAccountName: 'wangwu', displayName: '王五', ou: 'OU=技术部,DC=company,DC=com', mail: 'wangwu@company.com', status: 'pass' },
  { key: '2', index: 2, sAMAccountName: 'zhaoliu', displayName: '赵六', ou: 'OU=销售部,DC=company,DC=com', mail: 'zhaoliu@company.com', status: 'pass' },
  { key: '3', index: 3, sAMAccountName: 'sunqi', displayName: '孙七', ou: 'OU=人事部,DC=company,DC=com', mail: '', status: 'warn' },
]

const statusMap = {
  pass: { label: '通过', bg: '#f0fdf4', color: '#16a34a' },
  warn: { label: '警告', bg: '#fffbeb', color: '#d97706' },
}

const columns: ColumnsType<CreateRecord> = [
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
    title: 'OU路径',
    dataIndex: 'ou',
    key: 'ou',
    render: (text: string) => <span style={{ fontSize: 11, color: '#666' }}>{text}</span>,
  },
  {
    title: '邮箱',
    dataIndex: 'mail',
    key: 'mail',
    render: (text: string) => <span style={{ color: text ? '#1a1a1a' : '#999' }}>{text || '—'}</span>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: 'pass' | 'warn') => {
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
]

const BatchCreate: React.FC = () => (
  <>
    <TopBar title="批量创建用户" />
    <SearchBar />
    <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
      <StepsBar steps={[
        { label: '上传文件', status: 'done' },
        { label: '预览确认', status: 'active' },
        { label: '执行创建', status: 'pending' },
        { label: '完成', status: 'pending' },
      ]} />

      {/* Template download cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { title: 'CSV模板', desc: '逗号分隔格式' },
          { title: 'Excel模板', desc: 'xlsx格式' },
        ].map((tpl) => (
          <div
            key={tpl.title}
            style={{
              flex: 1, border: '1px solid #eee', borderRadius: 8, padding: '12px 16px',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1a1a1a' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#eee' }}
          >
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', marginBottom: 2 }}>{tpl.title}</div>
            <div style={{ fontSize: 11, color: '#999' }}>{tpl.desc}</div>
          </div>
        ))}
      </div>

      <UploadZone />

      {/* Preview section */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#666' }}>
          users_batch.xlsx — 25 条记录 · <span style={{ color: '#16a34a' }}>通过 23</span> · <span style={{ color: '#d97706' }}>警告 2</span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small">重新上传</Button>
          <Button size="small" type="primary" style={{ background: '#1a1a1a' }}>确认创建(23)</Button>
        </div>
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

export default BatchCreate
