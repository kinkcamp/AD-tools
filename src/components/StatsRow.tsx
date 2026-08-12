import React from 'react'

interface StatItem { label: string; value: number | string }
interface StatsRowProps { items: StatItem[] }

const StatsRow: React.FC<StatsRowProps> = ({ items }) => (
  <div style={{ display: 'flex', gap: 1, marginBottom: 16, background: '#eee', borderRadius: 8, overflow: 'hidden' }}>
    {items.map((item) => (
      <div key={item.label} style={{ flex: 1, background: '#fff', padding: '12px 16px' }}>
        <div style={{ fontSize: 10, color: '#999', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a', letterSpacing: -0.5 }}>{item.value}</div>
      </div>
    ))}
  </div>
)

export default StatsRow
