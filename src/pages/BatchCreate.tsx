import React, { useState } from 'react'
import { Table, Button, Input, Select, Progress, message } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { listen } from '@tauri-apps/api/event'
import TopBar from '../components/TopBar'
import StepsBar from '../components/StepsBar'
import UploadZone from '../components/UploadZone'
import { downloadTemplate } from '../utils/template'
import { tauriService } from '../services/tauri'
import type { BatchResult, CreateProgressEvent, NewUserSpec, ParsedRecord } from '../types'

const PWD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
const generatePassword = (length = 12) => {
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, (n) => PWD_CHARS[n % PWD_CHARS.length]).join('')
}

interface CreateRecord {
  key: string
  index: number
  // 提交后在 specs 数组中的位置（用于按索引匹配进度事件，避免重名行互相覆盖）
  specIdx?: number
  sAMAccountName: string
  displayName: string
  ou: string
  mail: string
  fields: Record<string, string>
  status: 'pass' | 'warn'
  // 执行期间的实时状态（后端进度事件驱动）
  live?: 'creating' | 'success' | 'failed'
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
  const [pwdMode, setPwdMode] = useState<'auto' | 'uniform' | 'file'>('auto')
  const [uniformPwd, setUniformPwd] = useState('')
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)
  // 实时进度（预检查/创建阶段）
  const [progress, setProgress] = useState<{ current: number; total: number; phase: string; message: string } | null>(null)

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
    // 一列都没匹配上时直接拦截，并告知文件实际检测到的列名，避免展示无法使用的空表
    if (mapped.length > 0 && !mapped.some(r => r.sAMAccountName)) {
      const detected = Object.keys(parsedRecords[0]?.fields ?? {})
      message.error(`找不到 sAMAccountName 列。文件检测到的列：${detected.join('、') || '（无）'}，请使用模板或包含该列的文件`)
      return
    }
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
    if (pwdMode === 'file' && targets.some(r => !r.fields['password'])) {
      message.error('文件指定密码模式下，每行都需要提供 password 列')
      return
    }
    let unlisten: (() => void) | undefined
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
        password: pwdMode === 'file' ? r.fields['password'] : pwdMode === 'uniform' ? uniformPwd : generatePassword(),
        attributes: r.fields,
      }))
      // 记录每个提交行在 specs 中的位置，进度事件按索引精确匹配
      const specIdxByName = new Map<string, number>()
      targets.forEach((r, i) => { if (!specIdxByName.has(r.key)) specIdxByName.set(r.key, i) })
      setRecords(prev => prev.map(r => ({ ...r, specIdx: specIdxByName.get(r.key) })))

      setCreating(true)
      setStep(2)
      setResult(null)
      setProgress({ current: 0, total: targets.length, phase: 'check', message: '连接域控…' })
      // 清除上一轮的实时状态
      setRecords(prev => prev.map(r => ({ ...r, live: undefined, resultMsg: undefined })))

      // 监听后端推送的实时进度事件（预检查 → 逐个创建），按提交索引精确匹配行
      unlisten = await listen<CreateProgressEvent>('batch-create-progress', ({ payload: p }) => {
        setProgress({ current: p.current, total: p.total, phase: p.phase, message: p.message })
        if (p.phase === 'create' && p.current > 0) {
          setRecords(prev => prev.map(r => r.specIdx === p.current - 1
            ? {
                ...r,
                live: p.status as 'creating' | 'success' | 'failed',
                resultMsg: p.status === 'creating' ? '创建中…' : p.message,
              }
            : r))
        }
      })

      const res = await tauriService.batchCreateUsers(cfg, specs)
      setResult(res)
      setStep(3)

      // 终态兼容回填：未收到实时事件的行（如被跳过的）按提交索引补上结果
      setRecords(prev => prev.map(r => {
        const d = r.specIdx !== undefined ? res.details[r.specIdx] : undefined
        return d && !r.resultMsg
          ? { ...r, resultMsg: d.message, live: d.success ? 'success' : 'failed' }
          : r
      }))

      if (res.failed === 0) message.success(`全部创建成功（${res.success}）`)
      else message.warning(`成功 ${res.success}，失败/跳过 ${res.failed}`)
    } catch (err) {
      setStep(1)
      message.error(`创建失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      unlisten?.()
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
      title: '状态', dataIndex: 'status', key: 'status', width: 130,
      render: (status: 'pass' | 'warn', record: CreateRecord) => {
        // 执行中：旋转图标 + 呼吸高亮由 onRow 动画驱动
        if (record.live === 'creating') {
          return (
            <span style={{ color: '#1a1a1a', fontSize: 11, fontWeight: 500 }}>
              <LoadingOutlined spin style={{ marginRight: 5 }} />创建中…
            </span>
          )
        }
        if (record.resultMsg) {
          const ok = record.live === 'success'
          const skipped = record.resultMsg.includes('已跳过')
          return (
            <span title={record.resultMsg} style={{ color: ok ? '#16a34a' : skipped ? '#d97706' : '#dc2626', fontSize: 11, fontWeight: 500, cursor: 'help' }}>
              {record.resultMsg.length > 24 ? record.resultMsg.slice(0, 24) + '…' : record.resultMsg}
            </span>
          )
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
      {/* 当前创建行的呼吸高亮动画 */}
      <style>{`
        @keyframes rowPulse {
          0%, 100% { background: #ffffff; }
          50% { background: #f0f5ff; }
        }
      `}</style>
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
            { title: 'CSV模板', desc: '逗号分隔格式（全部批量功能通用）', format: 'csv' as const },
            { title: 'Excel模板', desc: 'xlsx格式（全部批量功能通用）', format: 'xlsx' as const },
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
                  <Select value={pwdMode} onChange={setPwdMode} style={{ width: 130 }} size="small" options={[
                    { value: 'auto', label: '自动生成' },
                    { value: 'uniform', label: '统一密码' },
                    { value: 'file', label: '文件指定' },
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

            {/* 实时进度：预检查 → 逐个创建，active 状态自带流动条纹动画 */}
            {creating && progress && (
              <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>
                    <LoadingOutlined spin style={{ marginRight: 6 }} />
                    {progress.phase === 'check' ? '预检查（查重名/已存在用户）' : `正在创建 ${progress.current}/${progress.total}`}
                  </span>
                  <span style={{ fontSize: 11, color: '#666' }}>{progress.message}</span>
                </div>
                <Progress
                  percent={progress.phase === 'check' ? 5 : Math.round((progress.current / progress.total) * 100)}
                  status="active"
                  strokeColor="#1a1a1a"
                  size="small"
                />
              </div>
            )}

            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#666' }}>
                {fileName || '已解析文件'} — {records.length} 条记录 · <span style={{ color: '#16a34a' }}>通过 {passCount}</span> · <span style={{ color: '#d97706' }}>警告 {warnCount}</span>
                {result && <> · <span style={{ color: '#16a34a' }}>成功 {result.success}</span> · <span style={{ color: '#dc2626' }}>失败 {result.failed}</span></>}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" onClick={() => { setRecords([]); setFileName(''); setResult(null); setStep(0); setProgress(null) }}>重新上传</Button>
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
              onRow={(r) => r.live === 'creating'
                ? { style: { animation: 'rowPulse 1.2s ease-in-out infinite' } }
                : {}}
            />
          </>
        )}
      </div>
    </>
  )
}

export default BatchCreate
