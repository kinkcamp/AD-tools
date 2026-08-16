import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { tauriService } from '../services/tauri'

const navConfig = [
  {
    group: '用户管理',
    items: [{ key: '/', label: '用户中心', icon: '⌕' }],
  },
  {
    group: '批量操作',
    items: [
      { key: '/batch-create', label: '批量创建用户', icon: '+' },
      { key: '/batch-password', label: '批量修改密码', icon: '⚿' },
      { key: '/batch-group', label: '批量加入组', icon: '⊞' },
      { key: '/batch-attributes', label: '批量修改属性', icon: '✎' },
    ],
  },
  {
    group: '系统',
    items: [
      { key: '/settings', label: '连接设置', icon: '⚙' },
      { key: '/logs', label: '操作日志', icon: '☰' },
    ],
  },
]

type ConnectionStatus = 'unknown' | 'connected' | 'disconnected' | 'no-config'

const Sidebar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('unknown')

  useEffect(() => {
    let cancelled = false
    tauriService.getConfig().then(cfg => {
      if (cancelled) return
      if (!cfg.server || !cfg.domain) {
        setConnStatus('no-config')
      } else {
        tauriService.testConnection(cfg).then(() => {
          if (!cancelled) setConnStatus('connected')
        }).catch(() => {
          if (!cancelled) setConnStatus('disconnected')
        })
      }
    }).catch(() => {
      if (!cancelled) setConnStatus('no-config')
    })
    return () => { cancelled = true }
  }, [location.pathname])

  const statusConfig: Record<ConnectionStatus, { color: string; label: string }> = {
    unknown: { color: '#999', label: '检测中...' },
    connected: { color: '#52c41a', label: 'SSL 已连接' },
    disconnected: { color: '#e54d4d', label: '连接失败' },
    'no-config': { color: '#999', label: '未配置连接' },
  }

  const status = statusConfig[connStatus]

  return (
    <div style={{
      width: 200, background: '#fafafa', borderRight: '1px solid #eee',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%',
    }}>
      <div style={{ padding: '18px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, background: '#1a1a1a', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 11, fontWeight: 700,
        }}>AD</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>域控助手</span>
      </div>
      <div style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
        {navConfig.map((group) => (
          <div key={group.group} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#999', padding: '6px 10px', letterSpacing: 0.8, fontWeight: 500 }}>
              {group.group}
            </div>
            {group.items.map((item) => {
              const isActive = location.pathname === item.key
              return (
                <div key={item.key} onClick={() => navigate(item.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                  borderRadius: 5, cursor: 'pointer', fontSize: 12.5, transition: 'all 0.1s',
                  color: isActive ? '#1a1a1a' : '#666',
                  background: isActive ? '#f0f0f0' : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f0f0f0' }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center', opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                  {item.label}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ height: 40, padding: '0 16px', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', boxSizing: 'border-box', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: status.color, fontWeight: 500 }}>
          <div style={{ width: 6, height: 6, background: status.color, borderRadius: '50%' }} />
          {status.label}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
