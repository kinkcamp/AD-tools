import React from 'react'

interface TopBarProps {
  title: string
  actions?: React.ReactNode
}

const TopBar: React.FC<TopBarProps> = ({ title, actions }) => (
  <div style={{
    // 高度与侧边栏 logo 区一致（18px 上下内边距 + 28px 内容 = 64px）
    height: 64, borderBottom: '1px solid #eee', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
    padding: '0 20px', flexShrink: 0, boxSizing: 'border-box',
  }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', letterSpacing: -0.2 }}>{title}</span>
    <div style={{ display: 'flex', gap: 6 }}>{actions}</div>
  </div>
)

export default TopBar
