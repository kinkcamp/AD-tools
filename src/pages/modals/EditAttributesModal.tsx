import React, { useEffect, useState } from 'react'
import { Modal, Input, Button, Select, Spin, message, Empty } from 'antd'
import { tauriService } from '../../services/tauri'
import type { ADUser } from '../../types'

interface EditAttributesModalProps {
  user: ADUser | null
  onClose: () => void
  onSaved: () => void
}

interface AttrRow {
  name: string
  value: string
  // 打开时的原始值，用于判断是否修改/删除
  original: string
}

// 常用属性排前面，其余按字母序
const COMMON_ATTRS = [
  'displayName', 'mail', 'department', 'title', 'telephoneNumber',
  'description', 'company', 'employeeID', 'mobile', 'physicalDeliveryOfficeName',
  'wWWHomePage', 'postOfficeBox', 'uidNumber', 'gidNumber', 'givenName', 'sn',
]

const EditAttributesModal: React.FC<EditAttributesModalProps> = ({ user, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<AttrRow[]>([])
  const [schemaAttrs, setSchemaAttrs] = useState<string[]>([])
  const [newAttr, setNewAttr] = useState<string | undefined>(undefined)
  const [newValue, setNewValue] = useState('')
  // 记录加载完成时的初始行，用于检测"删除整行 = 清空属性"
  const initialRowsRef = React.useRef<AttrRow[]>([])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const config = await tauriService.getConfig()
        const [detail, schema] = await Promise.all([
          tauriService.getUserDetail(config, user.dn),
          tauriService.getUserAttributes(config).catch(() => [] as string[]),
        ])
        if (cancelled) return
        // 常用属性在前，其余按字母序
        const keys = Object.keys(detail).sort((a, b) => {
          const ia = COMMON_ATTRS.indexOf(a), ib = COMMON_ATTRS.indexOf(b)
          if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
          return a.localeCompare(b)
        })
        setRows(keys.map(k => ({ name: k, value: detail[k], original: detail[k] })))
        setSchemaAttrs(schema)
      } catch (err) {
        message.error(`读取属性失败: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const updateRow = (idx: number, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, value } : r))
  }

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  const addRow = () => {
    if (!newAttr) {
      message.warning('请选择要添加的属性')
      return
    }
    if (rows.some(r => r.name === newAttr)) {
      message.warning('该属性已在列表中')
      return
    }
    setRows(prev => [...prev, { name: newAttr, value: newValue, original: '' }])
    setNewAttr(undefined)
    setNewValue('')
  }

  const handleSave = async () => {
    if (!user) return
    // 值被修改的行 + 被移除但原本有值的行（空值 = 删除属性）
    const changed: Record<string, string> = {}
    for (const r of rows) {
      if (r.value !== r.original) changed[r.name] = r.value
    }
    const currentNames = new Set(rows.map(r => r.name))
    for (const r of initialRowsRef.current) {
      if (r.original && !currentNames.has(r.name)) changed[r.name] = ''
    }
    if (Object.keys(changed).length === 0) {
      message.info('没有修改')
      return
    }
    try {
      const config = await tauriService.getConfig()
      setSaving(true)
      const applied = await tauriService.modifyUserAttributes(config, user.dn, changed)
      message.success(`已保存 ${applied} 项属性修改`)
      onSaved()
      onClose()
    } catch (err) {
      message.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  // 加载完成时快照初始行
  useEffect(() => {
    if (!loading && user) initialRowsRef.current = rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const existingNames = new Set(rows.map(r => r.name.toLowerCase()))
  const addableAttrs = schemaAttrs.filter(a => !existingNames.has(a.toLowerCase()))

  return (
    <Modal
      open={!!user}
      title={<span style={{ fontSize: 13, fontWeight: 600 }}>编辑属性 — {user?.sAMAccountName} ({user?.displayName})</span>}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="ok" type="primary" loading={saving} onClick={handleSave}>保存</Button>,
      ]}
      width={560}
    >
      <Spin spinning={loading}>
        <div style={{ maxHeight: 380, overflowY: 'auto', marginBottom: 12 }}>
          {rows.length === 0 && !loading && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该用户暂无可编辑属性" style={{ margin: '16px 0' }} />
          )}
          {rows.map((r, idx) => (
            <div key={r.name} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <span style={{
                width: 170, fontSize: 11, color: '#555', fontFamily: 'monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
              }} title={r.name}>{r.name}</span>
              <Input
                size="small"
                value={r.value}
                onChange={(e) => updateRow(idx, e.target.value)}
                style={{ fontSize: 12 }}
              />
              <Button size="small" type="text" danger onClick={() => removeRow(idx)} style={{ fontSize: 11, flexShrink: 0 }}>
                移除
              </Button>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 500 }}>添加属性</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Select
              size="small"
              showSearch
              allowClear
              placeholder="选择属性名（可搜索）"
              style={{ width: 200 }}
              value={newAttr}
              onChange={setNewAttr}
              options={addableAttrs.map(a => ({ label: a, value: a }))}
              filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            />
            <Input
              size="small"
              placeholder="属性值"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              style={{ flex: 1, fontSize: 12 }}
              onPressEnter={addRow}
            />
            <Button size="small" onClick={addRow}>添加</Button>
          </div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 6 }}>
            清空属性值保存 = 从 AD 中删除该属性；系统保护属性（objectClass、userAccountControl 等）不可修改
          </div>
        </div>
      </Spin>
    </Modal>
  )
}

export default EditAttributesModal
