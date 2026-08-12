import React, { useState } from 'react'
import { Select, Input, Checkbox, Button, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import UploadZone from '../components/UploadZone'
import { tauriService } from '../services/tauri'
import type { BatchPasswordItem, BatchResult, ParsedRecord } from '../types'

const PWD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
const generatePassword = (length: number) => {
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, (n) => PWD_CHARS[n % PWD_CHARS.length]).join('')
}

interface PwdRecord {
  key: string
  index: number
  sAMAccountName: string
  password: string // 文件模式读取，其余模式执行时生成
  resultMsg?: string
}

const BatchPassword: React.FC = () => {
  const [mode, setMode] = useState('file')
  const [length, setLength] = useState(12)
  const [uniformPwd, setUniformPwd] = useState('')
  const [forceChange, setForceChange] = useState(true)
  const [exportList, setExportList] = useState(false)
  const [records, setRecords] = useState<PwdRecord[]>([])
  const [fileName, setFileName] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)
  const [passwords, setPasswords] = useState<{ username: string; password: string }[]>([])

  const handleFileParsed = (parsedRecords: ParsedRecord[], name?: string) => {
    const mapped: PwdRecord[] = parsedRecords.map((r, i) => ({
      key: String(i),
      index: i + 1,
      sAMAccountName: r.fields['sAMAccountName'] || '',
      password: r.fields['password'] || '',
    })).filter(r => r.sAMAccountName)
    if (mapped.length === 0) {
      message.error('文件中没有找到 sAMAccountName 列或无有效数据')
      return
    }
    setRecords(mapped)
    setResult(null)
    setPasswords([])
    if (name) setFileName(name)
  }

  const handleRun = async () => {
    if (records.length === 0) {
      message.error('请先上传包含 sAMAccountName 列的文件')
      return
    }
    if (mode === 'uniform' && uniformPwd.length < 8) {
      message.error('统一密码长度不能少于 8 位')
      return
    }
    if (mode === 'file' && records.some(r => !r.password)) {
      message.error('文件模式下每行都需要提供 password 列')
      return
    }
    const pwdLength = Math.min(Math.max(length, 8), 64)

    try {
      const cfg = await tauriService.getConfig()
      if (!cfg.server || !cfg.domain) {
        message.error('请先在连接设置中配置 AD 服务器')
        return
      }

      // 预先确定每个用户的密码（自动生成/统一/文件），以便导出清单
      const resolved = records.map(r => ({
        username: r.sAMAccountName,
        password: mode === 'file' ? r.password : mode === 'uniform' ? uniformPwd : generatePassword(pwdLength),
      }))

      const items: BatchPasswordItem[] = resolved.map(p => ({
        sAMAccountName: p.username,
        password: p.password,
        forceChange,
      }))

      setRunning(true)
      const res = await tauriService.batchChangePasswords(cfg, items)
      setResult(res)
      setPasswords(resolved)

      const byName = new Map(res.details.map(d => [d.username, d]))
      setRecords(prev => prev.map(r => {
        const d = byName.get(r.sAMAccountName)
        return d ? { ...r, resultMsg: d.success ? '已修改' : d.message } : r
      }))

      if (res.failed === 0) message.success(`全部修改成功（${res.success}）`)
      else message.warning(`成功 ${res.success}，失败 ${res.failed}`)

      // 导出密码清单（仅自动生成/统一模式有意义）
      if (exportList && mode !== 'file') {
        const header = 'sAMAccountName,password'
        const lines = resolved.map(p => `${p.username},${p.password}`)
        const blob = new Blob(['\ufeff' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `passwords_${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      message.error(`批量改密失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunning(false)
    }
  }

  const columns: ColumnsType<PwdRecord> = [
    { title: '#', dataIndex: 'index', key: 'index', width: 50 },
    {
      title: '用户名', dataIndex: 'sAMAccountName', key: 'sAMAccountName',
      render: (text: string) => <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{text}</span>,
    },
    {
      title: '结果', dataIndex: 'resultMsg', key: 'resultMsg',
      render: (text?: string) => {
        if (!text) return <span style={{ color: '#bbb' }}>待执行</span>
        const ok = text === '已修改'
        return <span style={{ color: ok ? '#16a34a' : '#dc2626', fontSize: 11 }}>{text}</span>
      },
    },
  ]

  return (
    <>
      <TopBar title="批量修改密码" />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>密码策略</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>密码模式</span>
              <Select value={mode} onChange={setMode} style={{ width: 140 }} size="small" options={[
                { value: 'file', label: '文件中指定' },
                { value: 'uniform', label: '统一密码' },
                { value: 'auto', label: '自动生成' },
              ]} />
            </div>
            {mode === 'uniform' && (
              <Input.Password
                value={uniformPwd}
                onChange={(e) => setUniformPwd(e.target.value)}
                placeholder="输入统一密码（≥8位）"
                style={{ width: 200 }}
                size="small"
              />
            )}
            {mode === 'auto' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>密码长度</span>
                <Input
                  type="number"
                  value={length}
                  min={8}
                  max={64}
                  onChange={(e) => setLength(Number(e.target.value))}
                  style={{ width: 80 }}
                  size="small"
                />
              </div>
            )}
            <Checkbox checked={forceChange} onChange={(e) => setForceChange(e.target.checked)}>
              <span style={{ fontSize: 11 }}>强制下次登录修改</span>
            </Checkbox>
            <Checkbox checked={exportList} onChange={(e) => setExportList(e.target.checked)} disabled={mode === 'file'}>
              <span style={{ fontSize: 11 }}>导出密码清单</span>
            </Checkbox>
          </div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 8 }}>
            提示: 文件需包含 sAMAccountName 列{mode === 'file' ? ' 和 password 列' : ''}
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
                <Button size="small" onClick={() => { setRecords([]); setFileName(''); setResult(null); setPasswords([]) }}>重新上传</Button>
                <Button size="small" type="primary" style={{ background: '#1a1a1a' }} onClick={handleRun} loading={running} disabled={!!result}>
                  {result ? '已完成' : `执行改密(${records.length})`}
                </Button>
              </div>
            </div>

            {result && (
              <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>
                    已处理 {result.total} / {result.total}
                  </span>
                  <span style={{ fontSize: 11 }}>
                    <span style={{ color: '#16a34a' }}>成功 {result.success}</span>
                    {' · '}
                    <span style={{ color: '#dc2626' }}>失败 {result.failed}</span>
                  </span>
                </div>
                <div style={{ background: '#f0f0f0', borderRadius: 2, height: 4, overflow: 'hidden' }}>
                  <div style={{ background: '#1a1a1a', height: '100%', width: '100%', borderRadius: 2 }} />
                </div>
              </div>
            )}

            <Table
              columns={columns}
              dataSource={records}
              size="small"
              pagination={records.length > 20 ? { pageSize: 20, size: 'small' } : false}
              style={{ fontSize: 12 }}
            />
          </>
        )}

        {passwords.length > 0 && exportList && mode !== 'file' && (
          <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
            密码清单已导出为 CSV 文件，请妥善保管后删除
          </div>
        )}
      </div>
    </>
  )
}

export default BatchPassword
