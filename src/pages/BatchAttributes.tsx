import React, { useState, useRef } from 'react'
import { Table, Button, Select, Input, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import UploadZone from '../components/UploadZone'
import { tauriService } from '../services/tauri'
import type { BatchResult, ParsedRecord } from '../types'

interface AttrRecord {
  key: string
  index: number
  sAMAccountName: string
  displayName: string
  fields: Record<string, string>
  resultMsg?: string
}

const attributeOptions = [
  { value: 'department', label: 'department' },
  { value: 'title', label: 'title' },
  { value: 'telephoneNumber', label: 'telephoneNumber' },
  { value: 'mail', label: 'mail' },
  { value: 'company', label: 'company' },
  { value: 'physicalDeliveryOfficeName', label: 'physicalDeliveryOfficeName' },
  { value: 'description', label: 'description' },
  { value: 'employeeID', label: 'employeeID' },
]

interface Rule {
  id: number
  attribute: string
  value: string
}

const BatchAttributes: React.FC = () => {
  const [attr, setAttr] = useState('department')
  const [method, setMethod] = useState('uniform')
  const [newValue, setNewValue] = useState('')
  const [rules, setRules] = useState<Rule[]>([])
  const [records, setRecords] = useState<AttrRecord[]>([])
  const [fileName, setFileName] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)
  const nextIdRef = useRef(1)

  const addRule = () => {
    setRules([...rules, { id: nextIdRef.current++, attribute: 'title', value: '' }])
  }

  const removeRule = (id: number) => {
    setRules(rules.filter((r) => r.id !== id))
  }

  const updateRule = (id: number, field: 'attribute' | 'value', val: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }

  const handleFileParsed = (parsedRecords: ParsedRecord[], name?: string) => {
    const mapped: AttrRecord[] = parsedRecords.map((r, i) => ({
      key: String(i),
      index: i + 1,
      sAMAccountName: r.fields['sAMAccountName'] || '',
      displayName: r.fields['displayName'] || '',
      fields: r.fields,
    })).filter(r => r.sAMAccountName)
    if (mapped.length === 0) {
      message.error('文件中没有找到 sAMAccountName 列或无有效数据')
      return
    }
    setRecords(mapped)
    setResult(null)
    if (name) setFileName(name)
  }

  const handleConfirm = async () => {
    if (records.length === 0) {
      message.error('请先上传包含用户名的文件')
      return
    }
    if (method !== 'file' && !newValue.trim()) {
      message.error('请输入新值')
      return
    }
    const validRules = rules.filter(r => r.attribute !== attr && r.value.trim())
    if (method === 'file' && records.every(r => !(r.fields[attr] || '').trim())) {
      message.error(`文件中没有找到 ${attr} 列（文件读取模式需要该列）`)
      return
    }

    try {
      const cfg = await tauriService.getConfig()
      if (!cfg.server || !cfg.domain) {
        message.error('请先在连接设置中配置 AD 服务器')
        return
      }

      // 统一值：主属性 + 附加规则；文件模式下主属性值由 perUserValues 提供
      const mods: Record<string, string> = { [attr]: method === 'file' ? '' : newValue.trim() }
      validRules.forEach(r => { mods[r.attribute] = r.value.trim() })

      const perUserValues: Record<string, Record<string, string>> = {}
      if (method === 'file') {
        records.forEach(r => {
          const v = (r.fields[attr] || '').trim()
          if (v) perUserValues[r.sAMAccountName] = { [attr]: v }
        })
      }

      setRunning(true)
      const res = await tauriService.batchModifyAttributes(
        cfg,
        records.map(r => r.sAMAccountName),
        mods,
        perUserValues,
        method === 'append',
      )
      setResult(res)

      const byName = new Map(res.details.map(d => [d.username, d]))
      setRecords(prev => prev.map(r => {
        const d = byName.get(r.sAMAccountName)
        return d ? { ...r, resultMsg: d.success ? '已更新' : d.message } : r
      }))

      if (res.failed === 0) message.success(`全部修改成功（${res.success}）`)
      else message.warning(`成功 ${res.success}，失败 ${res.failed}`)
    } catch (err) {
      message.error(`修改属性失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunning(false)
    }
  }

  const columns: ColumnsType<AttrRecord> = [
    { title: '#', dataIndex: 'index', key: 'index', width: 50 },
    {
      title: '用户名', dataIndex: 'sAMAccountName', key: 'sAMAccountName',
      render: (text: string) => <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{text}</span>,
    },
    { title: '姓名', dataIndex: 'displayName', key: 'displayName' },
    {
      title: `${attr}(新)`, key: 'primary', width: 140,
      render: (_: unknown, record: AttrRecord) => {
        const v = method === 'file' ? record.fields[attr] : newValue
        return <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 11 }}>{v || '—'}</span>
      },
    },
    ...validPreviewRules().map((rule) => ({
      title: `${rule.attribute}(新)`,
      key: `rule_${rule.id}`,
      width: 140,
      render: () => (
        <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 11 }}>
          {rule.value || '—'}
        </span>
      ),
    })),
    {
      title: '结果', dataIndex: 'resultMsg', key: 'resultMsg', width: 120,
      render: (text?: string) => {
        if (!text) return <span style={{ color: '#bbb', fontSize: 11 }}>待执行</span>
        const ok = text === '已更新'
        return <span style={{ color: ok ? '#16a34a' : '#dc2626', fontSize: 11 }}>{text}</span>
      },
    },
  ]

  function validPreviewRules() {
    return rules.filter(r => r.attribute !== attr && r.value.trim())
  }

  return (
    <>
      <TopBar title="批量修改属性" />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>选择要修改的属性</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>属性字段</span>
              <Select value={attr} onChange={setAttr} style={{ width: 180 }} size="small" options={attributeOptions} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>修改方式</span>
              <Select value={method} onChange={setMethod} style={{ width: 120 }} size="small" options={[
                { value: 'uniform', label: '统一设置' },
                { value: 'file', label: '文件读取' },
                { value: 'append', label: '追加值' },
              ]} />
            </div>
            {method !== 'file' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>新值</span>
                <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="输入新值" style={{ width: 160 }} size="small" />
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 8 }}>
            提示: {method === 'uniform' ? '统一设置将对所有用户应用相同的值'
              : method === 'file' ? `文件读取模式将从文件的 ${attr} 列逐行取值`
              : '追加值将在每个用户现有值后面追加新值'}
          </div>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>多属性同时修改（可选）</div>
          {rules.map((rule) => (
            <div key={rule.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <Select
                value={rule.attribute}
                onChange={(val) => updateRule(rule.id, 'attribute', val)}
                style={{ width: 180 }}
                size="small"
                options={attributeOptions}
              />
              <Input
                value={rule.value}
                onChange={(e) => updateRule(rule.id, 'value', e.target.value)}
                placeholder="输入值"
                style={{ width: 160 }}
                size="small"
              />
              <Button size="small" danger onClick={() => removeRule(rule.id)}>移除</Button>
            </div>
          ))}
          <Button size="small" onClick={addRule}>+ 添加规则</Button>
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
                <Button size="small" onClick={() => { setRecords([]); setFileName(''); setResult(null) }}>重新上传</Button>
                <Button size="small" type="primary" style={{ background: '#1a1a1a' }} onClick={handleConfirm} loading={running} disabled={!!result}>
                  {result ? '已完成' : '确认执行'}
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

export default BatchAttributes
