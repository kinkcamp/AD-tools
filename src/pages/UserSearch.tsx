import React, { useEffect, useState } from 'react'
import { Table, Button, message, Popconfirm, Modal } from 'antd'
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
    title: 'UID',
    dataIndex: 'uidNumber',
    key: 'uidNumber',
    width: 70,
    render: (text: string) => text ? <span style={{ fontFamily: 'monospace' }}>{text}</span> : <span style={{ color: '#ccc' }}>—</span>,
  },
  {
    title: 'GID',
    dataIndex: 'gidNumber',
    key: 'gidNumber',
    width: 70,
    render: (text: string) => text ? <span style={{ fontFamily: 'monospace' }}>{text}</span> : <span style={{ color: '#ccc' }}>—</span>,
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

const csvCell = (v: string) => {
  // CSV 转义：包含逗号/引号/换行时加引号包裹
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

const UserSearch: React.FC = () => {
  const [users, setUsers] = useState<ADUser[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [passwordModal, setPasswordModal] = useState<{ open: boolean; user: ADUser | null }>({ open: false, user: null })

  // 进入页面自动加载 Users 容器下的用户（系统内置账户已由后端排除）
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const config = await tauriService.getConfig()
        if (!config.server || !config.domain) return
        setLoading(true)
        const result = await tauriService.listUsers(config)
        if (!cancelled) setUsers(result)
      } catch {
        // 连接失败时静默处理，由侧边栏状态与手动搜索提示覆盖
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleSearch = async (keyword: string, ouFilter: string) => {
    if (!keyword.trim()) {
      message.warning('请输入搜索关键词')
      return
    }
    setLoading(true)
    try {
      const config = await tauriService.getConfig()
      if (!config.server || !config.domain) {
        message.error('请先在连接设置中配置 AD 服务器')
        return
      }
      const result = await tauriService.searchUsers(config, keyword, ouFilter)
      setUsers(result)
      setSelectedKeys([])
      if (result.length === 0) message.info('未找到匹配的用户')
    } catch (err) {
      message.error(`搜索失败: ${err instanceof Error ? err.message : String(err)}`)
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
      message.error(`修改失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDelete = async (userDn: string) => {
    try {
      const config = await tauriService.getConfig()
      await tauriService.deleteUser(config, userDn)
      message.success('用户已删除')
      setUsers(prev => prev.filter(u => u.dn !== userDn))
    } catch (err) {
      message.error(`删除失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 导出当前搜索结果为 CSV
  const handleExport = () => {
    if (users.length === 0) {
      message.warning('没有可导出的数据')
      return
    }
    const headers = ['sAMAccountName', 'displayName', 'mail', 'department', 'uidNumber', 'gidNumber', 'status', 'dn']
    const lines = users.map(u => [
      u.sAMAccountName, u.displayName, u.mail, u.department,
      u.uidNumber, u.gidNumber,
      statusMap[u.status]?.label || u.status, u.dn,
    ].map(csvCell).join(','))
    const blob = new Blob(['\ufeff' + [headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success(`已导出 ${users.length} 条记录`)
  }

  // 批量删除选中用户（二次确认 + 逐个执行）
  const handleBatchDelete = () => {
    const targets = users.filter(u => selectedKeys.includes(u.dn))
    if (targets.length === 0) {
      message.warning('请先勾选要删除的用户')
      return
    }
    Modal.confirm({
      title: `确认删除 ${targets.length} 个用户？`,
      content: `将从 AD 中永久删除: ${targets.slice(0, 5).map(u => u.sAMAccountName).join(', ')}${targets.length > 5 ? ` 等 ${targets.length} 个用户` : ''}。此操作不可恢复。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const config = await tauriService.getConfig()
          setBatchDeleting(true)
          let success = 0
          const failedNames: string[] = []
          for (const u of targets) {
            try {
              await tauriService.deleteUser(config, u.dn)
              success++
            } catch {
              failedNames.push(u.sAMAccountName)
            }
          }
          setUsers(prev => prev.filter(u => !selectedKeys.includes(u.dn) || failedNames.includes(u.sAMAccountName)))
          setSelectedKeys(failedNames.length > 0 ? users.filter(u => failedNames.includes(u.sAMAccountName)).map(u => u.dn) : [])
          if (failedNames.length === 0) message.success(`已删除 ${success} 个用户`)
          else message.warning(`成功 ${success}，失败 ${failedNames.length}: ${failedNames.join(', ')}`)
        } catch (err) {
          message.error(`批量删除失败: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          setBatchDeleting(false)
        }
      },
    })
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
          <Button size="small" onClick={handleExport} disabled={users.length === 0}>导出</Button>
          <Button size="small" danger onClick={handleBatchDelete} loading={batchDeleting} disabled={selectedKeys.length === 0}>
            批量删除{selectedKeys.length > 0 ? `(${selectedKeys.length})` : ''}
          </Button>
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
        rowKey="dn"
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
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys),
        }}
        onRow={(record) => ({ onDoubleClick: () => setPasswordModal({ open: true, user: record }) })}
        locale={{ emptyText: loading ? '加载中...' : '暂无用户，可输入关键词搜索' }}
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

