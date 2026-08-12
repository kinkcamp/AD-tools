import React, { useState } from 'react'
import { Table, Button, message, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import StatsRow from '../components/StatsRow'
import ChangePasswordModal from './modals/ChangePasswordModal'
import { tauriService } from '../services/tauri'
import type { ADUser } from '../types'

const statusMap = {
  active: { label: '活跃', bg: '#f0fdf4', color: '#16a34a' },
  disabled: { label: '已禁用', bg: '#fef2f2', color: '#dc2626' },
  locked: { label: '已锁定', bg: '#fffbeb', color: '#d97706' },
}

const columns: ColumnsType<ADUser> = [
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
    render: (status: ADUser['status']) => {
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

const UserSearch: React.FC = () => {
  const [users, setUsers] = useState<ADUser[]>([])
  const [loading, setLoading] = useState(false)
  const [passwordModal, setPasswordModal] = useState<{ open: boolean; user: ADUser | null }>({ open: false, user: null })

  const handleSearch = async (keyword: string, ouFilter: string) => {
    setLoading(true)
    try {
      const config = await tauriService.getConfig()
      const result = await tauriService.searchUsers(config, keyword, ouFilter)
      setUsers(result)
    } catch (err) {
      message.error(`搜索失败: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (userDn: string, newPassword: string, forceChange: boolean) => {
    try {
      const config = await tauriService.getConfig()
      await tauriService.changePassword(config, userDn, newPassword, forceChange)
      message.success('密码修改成功')
    } catch (err) {
      message.error(`修改失败: ${err}`)
    }
  }

  const handleDelete = async (userDn: string) => {
    try {
      const config = await tauriService.getConfig()
      await tauriService.deleteUser(config, userDn)
      message.success('用户已删除')
      setUsers(prev => prev.filter(u => u.dn !== userDn))
    } catch (err) {
      message.error(`删除失败: ${err}`)
    }
  }

  const activeCount = users.filter(u => u.status === 'active').length
  const disabledCount = users.filter(u => u.status === 'disabled').length
  const lockedCount = users.filter(u => u.status === 'locked').length

  return (
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
    <SearchBar onSearch={handleSearch} />
    <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
      <StatsRow items={[
        { label: '搜索结果', value: users.length },
        { label: '活跃', value: activeCount },
        { label: '已禁用', value: disabledCount },
        { label: '已锁定', value: lockedCount },
      ]} />
      <Table
        columns={[...columns, {
          title: '操作', key: 'action', width: 80,
          render: (_: unknown, record: ADUser) => (
            <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.dn)} okText="删除" cancelText="取消">
              <Button size="small" danger type="link" style={{ fontSize: 11, padding: 0 }}>删除</Button>
            </Popconfirm>
          ),
        }]}
        dataSource={users}
        loading={loading}
        size="small"
        rowSelection={{ type: 'checkbox' }}
        onRow={(record) => ({ onDoubleClick: () => setPasswordModal({ open: true, user: record }) })}
        locale={{ emptyText: '输入关键词搜索用户' }}
        pagination={users.length > 0 ? {
          pageSize: 10,
          showTotal: (total, range) => `显示 ${range[0]}-${range[1]} / 共 ${total} 条`,
          size: 'small',
        } : false}
        style={{ fontSize: 12 }}
      />
    </div>
    {passwordModal.user && (
      <ChangePasswordModal
        open={passwordModal.open}
        username={passwordModal.user.sAMAccountName}
        displayName={passwordModal.user.displayName}
        onClose={() => setPasswordModal({ open: false, user: null })}
        onConfirm={(pwd, force) => {
          handleChangePassword(passwordModal.user!.dn, pwd, force)
          setPasswordModal({ open: false, user: null })
        }}
      />
    )}
  </>
  )
}

export default UserSearch
