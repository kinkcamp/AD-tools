import React from 'react'

interface Step { label: string; status: 'done' | 'active' | 'pending' }
interface StepsBarProps { steps: Step[] }

const StepsBar: React.FC<StepsBarProps> = ({ steps }) => (
  <div style={{ display: 'flex', marginBottom: 16 }}>
    {steps.map((step, i) => {
      const numBg = step.status === 'done' ? '#52c41a' : step.status === 'active' ? '#1a1a1a' : '#f0f0f0'
      const numColor = step.status === 'pending' ? '#999' : '#fff'
      const labelColor = step.status === 'active' ? '#1a1a1a' : step.status === 'done' ? '#52c41a' : '#999'
      return (
        <div key={i} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', background: numBg,
            color: numColor, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 11, fontWeight: 600, marginBottom: 4,
          }}>{step.status === 'done' ? '✓' : i + 1}</div>
          <div style={{ fontSize: 10, color: labelColor, fontWeight: step.status === 'active' ? 500 : 400 }}>{step.label}</div>
          {i < steps.length - 1 && (
            <div style={{ position: 'absolute', top: 12, left: '60%', right: '-40%', height: 1, background: step.status === 'done' ? '#52c41a' : '#eee' }} />
          )}
        </div>
      )
    })}
  </div>
)

export default StepsBar
