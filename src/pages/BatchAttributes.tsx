import React, { useState } from 'react'
import { Table, Button, Select, Input } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import UploadZone from '../components/UploadZone'

interface AttrRecord {
  key: string
  index: number
  sAMAccountName: string
  displayName: string
  deptOld: string
  deptNew: string
  titleOld: string
  titleNew: string
}

const mockData: AttrRecord[] = [
  { key: '1', index: 1, sAMAccountName: 'zhangsan', displayName: '张三', deptOld: '销售部', deptNew: '技术部', titleOld: '销售专员', titleNew: '高级工程师' },
  { key: '2', index: 2, sAMAccountName: 'wangwu', displayName: '王五', deptOld: '人事部', deptNew: '技术部', titleOld: 'HR专员', titleNew: '高级工程师' },
  { key: '3', index: 3, sAMAccountName: 'zhaoliu', displayName: '赵六', deptOld: '财务部', deptNew: '技术部', titleOld: '会计', titleNew: '高级工程师' },
]

const attributeOptions = [
  { value: 'department', label: 'department' },
  { value: 'title', label: 'title' },
  { value: 'telephoneNumber', label: 'telephoneNumber' },
  { value: 'mail', label: 'mail' },
  { value: 'manager', label: 'manager' },
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
  const [rules, setRules] = useState<Rule[]>([
    { id: 1, attribute: 'department', value: '技术部' },
    { id: 2, attribute: 'title', value: '高级工程师' },
  ])
  let nextId = 3

  const addRule = () => {
    setRules([...rules, { id: nextId++, attribute: 'department', value: '' }])
  }

  const removeRule = (id: number) => {
    setRules(rules.filter((r) => r.id !== id))
  }

  const updateRule = (id: number, field: 'attribute' | 'value', val: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }

  const columns: ColumnsType<AttrRecord> = [
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
      title: '部门(原)',
      dataIndex: 'deptOld',
      key: 'deptOld',
      render: (text: string) => <span style={{ color: '#999', fontSize: 11 }}>{text}</span>,
    },
    {
      title: '部门(新)',
      dataIndex: 'deptNew',
      key: 'deptNew',
      render: (text: string) => <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 11 }}>{text}</span>,
    },
    {
      title: '职位(原)',
      dataIndex: 'titleOld',
      key: 'titleOld',
      render: (text: string) => <span style={{ color: '#999', fontSize: 11 }}>{text}</span>,
    },
    {
      title: '职位(新)',
      dataIndex: 'titleNew',
      key: 'titleNew',
      render: (text: string) => <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 11 }}>{text}</span>,
    },
  ]

  return (
    <>
      <TopBar title="批量修改属性" />
      <SearchBar />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        {/* Form card 1 */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>新值</span>
              <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="输入新值" style={{ width: 160 }} size="small" />
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 8 }}>提示: 统一设置将对所有选中用户应用相同的值</div>
        </div>

        {/* Form card 2 */}
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

        <UploadZone />

        {/* Preview info */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#666' }}>users_update.csv — 3 个用户</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small">重新上传</Button>
            <Button size="small" type="primary" style={{ background: '#1a1a1a' }}>确认执行</Button>
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
}

export default BatchAttributes
