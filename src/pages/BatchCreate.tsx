import React, { useState } from 'react'
import { Table, Button, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import StepsBar from '../components/StepsBar'
import UploadZone from '../components/UploadZone'
import type { ParsedRecord } from '../types'

// 客户端生成模板并下载，避免依赖后端文件系统权限
const downloadTemplate = (format: 'csv' | 'xlsx') => {
  const headers = ['sAMAccountName', 'displayName', 'mail', 'department', 'title', 'telephoneNumber', 'description', 'userPrincipalName', 'givenName', 'sn']
  const example = ['zhangsan', '张三', 'zhangsan@company.com', '技术部', '工程师', '13800138000', '', 'zhangsan@company.com', '三', '张']

  if (format === 'csv') {
    const content = '\ufeff' + [headers.join(','), example.join(',')].join('\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'user_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  } else {
    // Excel 模板通过 xlsx 库生成
    import('xlsx').then((XLSX) => {
      const ws = XLSX.utils.aoa_to_sheet([headers, example])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'users')
      XLSX.writeFile(wb, 'user_template.xlsx')
    })
  }
}

interface CreateRecord {
  key: string
  index: number
  sAMAccountName: string
  displayName: string
  ou: string
  mail: string
  status: 'pass' | 'warn'
}

const statusMap = {
  pass: { label: '通过', bg: '#f0fdf4', color: '#16a34a' },
  warn: { label: '警告', bg: '#fffbeb', color: '#d97706' },
}

const BatchCreate: React.FC = () => {
  const [records, setRecords] = useState<CreateRecord[]>([])
  const [fileName, setFileName] = useState('')
  const [step, setStep] = useState(0)

  const handleFileParsed = async (parsedRecords: ParsedRecord[]) => {
    const mapped: CreateRecord[] = parsedRecords.map((r, i) => ({
      key: String(i),
      index: i + 1,
      sAMAccountName: r.fields['sAMAccountName'] || '',
      displayName: r.fields['displayName'] || '',
      ou: r.fields['ou'] || '',
      mail: r.fields['mail'] || '',
      status: r.fields['sAMAccountName'] ? 'pass' as const : 'warn' as const,
    }))
    setRecords(mapped)
    setStep(1)
  }

  const handleConfirmCreate = async () => {
    message.info('创建功能将在连接 AD 后可用')
  }

  const passCount = records.filter(r => r.status === 'pass').length
  const warnCount = records.filter(r => r.status === 'warn').length

  const columns: ColumnsType<CreateRecord> = [
    { title: '#', dataIndex: 'index', key: 'index', width: 50 },
    {
      title: '用户名', dataIndex: 'sAMAccountName', key: 'sAMAccountName',
      render: (text: string) => <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{text}</span>,
    },
    { title: '姓名', dataIndex: 'displayName', key: 'displayName' },
    {
      title: 'OU路径', dataIndex: 'ou', key: 'ou',
      render: (text: string) => <span style={{ fontSize: 11, color: '#666' }}>{text}</span>,
    },
    {
      title: '邮箱', dataIndex: 'mail', key: 'mail',
      render: (text: string) => <span style={{ color: text ? '#1a1a1a' : '#999' }}>{text || '—'}</span>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
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

  return (
    <>
      <TopBar title="批量创建用户" />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        <StepsBar steps={[
          { label: '上传文件', status: step >= 0 ? 'done' : 'pending' },
          { label: '预览确认', status: step >= 1 ? 'active' : 'pending' },
          { label: '执行创建', status: step >= 2 ? 'done' : 'pending' },
          { label: '完成', status: step >= 3 ? 'done' : 'pending' },
        ]} />

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {[
            { title: 'CSV模板', desc: '逗号分隔格式', format: 'csv' as const },
            { title: 'Excel模板', desc: 'xlsx格式', format: 'xlsx' as const },
          ].map((tpl) => (
            <div
              key={tpl.title}
              style={{
                flex: 1, border: '1px solid #eee', borderRadius: 8, padding: '12px 16px',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1a1a1a' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#eee' }}
              onClick={() => downloadTemplate(tpl.format)}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', marginBottom: 2 }}>{tpl.title}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{tpl.desc}</div>
            </div>
          ))}
        </div>

        <UploadZone onFileParsed={handleFileParsed} />

        {records.length > 0 && (
          <>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#666' }}>
                {fileName || '已解析文件'} — {records.length} 条记录 · <span style={{ color: '#16a34a' }}>通过 {passCount}</span> · <span style={{ color: '#d97706' }}>警告 {warnCount}</span>
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" onClick={() => { setRecords([]); setFileName(''); setStep(0) }}>重新上传</Button>
                <Button size="small" type="primary" style={{ background: '#1a1a1a' }} onClick={handleConfirmCreate}>确认创建({passCount})</Button>
              </div>
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

export default BatchCreate
