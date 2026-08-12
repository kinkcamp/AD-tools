import React, { useState } from 'react'
import { Table, Button, Input, Select, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import StepsBar from '../components/StepsBar'
import UploadZone from '../components/UploadZone'
import { tauriService } from '../services/tauri'
import type { BatchResult, NewUserSpec, ParsedRecord } from '../types'

// 客户端生成模板并下载，避免依赖后端文件系统权限
const downloadTemplate = (format: 'csv' | 'xlsx') => {
  const headers = ['sAMAccountName', 'displayName', 'ou', 'mail', 'department', 'title', 'telephoneNumber', 'description', 'userPrincipalName', 'givenName', 'sn']
  const example = ['zhangsan', '张三', 'OU=Users,DC=company,DC=com', 'zhangsan@company.com', '技术部', '工程师', '13800138000', '', 'zhangsan@company.com', '三', '张']

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

const PWD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
const generatePassword = (length = 12) => {
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, (n) => PWD_CHARS[n % PWD_CHARS.length]).join('')
}

interface CreateRecord {
  key: string
  index: number
  sAMAccountName: string
  displayName: string
  ou: string
  mail: string
  fields: Record<string, string>
  status: 'pass' | 'warn'
  resultMsg?: string
}

const statusMap = {
  pass: { label: '通过', bg: '#f0fdf4', color: '#16a34a' },
  warn: { label: '警告', bg: '#fffbeb', color: '#d97706' },
}

const BatchCreate: React.FC = () => {
  const [records, setRecords] = useState<CreateRecord[]>([])
  const [fileName, setFileName] = useState('')
  const [step, setStep] = useState(0)
  const [defaultOu, setDefaultOu] = useState('')
  const [pwdMode, setPwdMode] = useState<'auto' | 'uniform'>('auto')
  const [uniformPwd, setUniformPwd] = useState('')
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)

  const handleFileParsed = (parsedRecords: ParsedRecord[], name?: string) => {
    const mapped: CreateRecord[] = parsedRecords.map((r, i) => ({
      key: String(i),
      index: i + 1,
      sAMAccountName: r.fields['sAMAccountName'] || '',
      displayName: r.fields['displayName'] || '',
      ou: r.fields['ou'] || '',
      mail: r.fields['mail'] || '',
      fields: r.fields,
      status: r.fields['sAMAccountName'] ? 'pass' as const : 'warn' as const,
    }))
    setRecords(mapped)
    setResult(null)
    setStep(1)
    if (name) setFileName(name)
  }

  const handleConfirmCreate = async () => {
    const targets = records.filter(r => r.status === 'pass')
    if (targets.length === 0) {
      message.error('没有可创建的有效记录（缺少 sAMAccountName）')
      return
    }
    if (pwdMode === 'uniform' && uniformPwd.length < 8) {
      message.error('统一初始密码长度不能少于 8 位')
      return
    }
    try {
      const cfg = await tauriService.getConfig()
      if (!cfg.server || !cfg.domain) {
        message.error('请先在连接设置中配置 AD 服务器')
        return
      }

      const specs: NewUserSpec[] = targets.map(r => ({
        sAMAccountName: r.sAMAccountName,
        displayName: r.displayName,
        ou: r.ou || defaultOu.trim(),
        password: pwdMode === 'uniform' ? uniformPwd : generatePassword(),
        attributes: r.fields,
      }))

      setCreating(true)
      setStep(2)
      const res = await tauriService.batchCreateUsers(cfg, specs)
      setResult(res)
      setStep(3)

      // 逐行回填结果
      const byName = new Map(res.details.map(d => [d.username, d]))
      setRecords(prev => prev.map(r => {
        const d = byName.get(r.sAMAccountName)
        return d ? { ...r, resultMsg: d.success ? '创建成功' : d.message } : r
      }))

      if (res.failed === 0) message.success(`全部创建成功（${res.success}）`)
      else message.warning(`成功 ${res.success}，失败 ${res.failed}`)
    } catch (err) {
      setStep(1)
      message.error(`创建失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setCreating(false)
    }
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
      render: (text: string) => <span style={{ fontSize: 11, color: text ? '#666' : '#bbb' }}>{text || '（默认）'}</span>,
    },
    {
      title: '邮箱', dataIndex: 'mail', key: 'mail',
      render: (text: string) => <span style={{ color: text ? '#1a1a1a' : '#999' }}>{text || '—'}</span>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (status: 'pass' | 'warn', record: CreateRecord) => {
        if (record.resultMsg) {
          const ok = record.resultMsg === '创建成功'
          return <span style={{ color: ok ? '#16a34a' : '#dc2626', fontSize: 11, fontWeight: 500 }}>{record.resultMsg}</span>
        }
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
          { label: '上传文件', status: step >= 1 ? 'done' : 'active' },
          { label: '预览确认', status: step >= 2 ? 'done' : step === 1 ? 'active' : 'pending' },
          { label: '执行创建', status: step >= 3 ? 'done' : step === 2 ? 'active' : 'pending' },
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
            <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>创建选项</div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>默认OU</span>
                  <Input
                    value={defaultOu}
                    onChange={(e) => setDefaultOu(e.target.value)}
                    placeholder="OU=Users,DC=company,DC=com（行内未指定时使用）"
                    style={{ width: 300 }}
                    size="small"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>初始密码</span>
                  <Select value={pwdMode} onChange={setPwdMode} style={{ width: 110 }} size="small" options={[
                    { value: 'auto', label: '自动生成' },
                    { value: 'uniform', label: '统一密码' },
                  ]} />
                  {pwdMode === 'uniform' && (
                    <Input.Password
                      value={uniformPwd}
                      onChange={(e) => setUniformPwd(e.target.value)}
                      placeholder="输入统一初始密码（≥8位）"
                      style={{ width: 200 }}
                      size="small"
                    />
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#666' }}>
                {fileName || '已解析文件'} — {records.length} 条记录 · <span style={{ color: '#16a34a' }}>通过 {passCount}</span> · <span style={{ color: '#d97706' }}>警告 {warnCount}</span>
                {result && <> · <span style={{ color: '#16a34a' }}>成功 {result.success}</span> · <span style={{ color: '#dc2626' }}>失败 {result.failed}</span></>}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" onClick={() => { setRecords([]); setFileName(''); setResult(null); setStep(0) }}>重新上传</Button>
                <Button size="small" type="primary" style={{ background: '#1a1a1a' }} onClick={handleConfirmCreate} loading={creating} disabled={step === 3}>
                  {result ? '已完成' : `确认创建(${passCount})`}
                </Button>
              </div>
            </div>

            <Table
              columns={columns}
              dataSource={records}
              size="small"
              pagination={records.length > 20 ? { pageSize: 20, size: 'small' } : false}
              style={{ fontSize: 12 }}
            />
          </>
        )}
      </div>
    </>
  )
}

export default BatchCreate
