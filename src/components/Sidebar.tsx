import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { tauriService } from '../services/tauri'

const navConfig = [
  {
    group: '用户管理',
    items: [{ key: '/', label: '搜索用户', icon: '⌕' }],
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
  const [sslEnabled, setSslEnabled] = useState(false)

  useEffect(() => {
    tauriService.getConfig().then(cfg => {
      setSslEnabled(cfg.sslEnabled)
      if (!cfg.ldapHost) {
        setConnStatus('no-config')
      } else {
        // Try a quick connection test to get real status
        tauriService.testConnection(cfg).then(() => {
          setConnStatus('connected')
        }).catch(() => {
          setConnStatus('disconnected')
        })
      }
    }).catch(() => {
      setConnStatus('no-config')
    })
  }, [location.pathname])

  const statusConfig = {
    unknown: { color: '#999', bg: '#999', label: '检测中...' },
    connected: { color: sslEnabled ? '#52c41a' : '#d97706', bg: sslEnabled ? '#52c41a' : '#d97706', label: sslEnabled ? 'SSL 已连接' : '已连接 (未加密)' },
    disconnected: { color: '#e54d4d', bg: '#e54d4d', label: '连接失败' },
    'no-config': { color: '#999', bg: '#999', label: '未配置连接' },
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
      <div style={{ padding: '12px 16px', borderTop: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: status.color, fontWeight: 500 }}>
          <div style={{ width: 6, height: 6, background: status.bg, borderRadius: '50%' }} />
          {status.label}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
