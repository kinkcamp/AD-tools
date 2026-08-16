import React, { useState } from 'react'
import { Modal, Input, Checkbox, Button, message } from 'antd'

interface ChangePasswordModalProps {
  open: boolean
  username: string
  displayName: string
  onClose: () => void
  onConfirm: (newPassword: string, forceChange: boolean) => void
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  open, username, displayName, onClose, onConfirm,
}) => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [forceChange, setForceChange] = useState(true)

  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3
  const strengthLabels = ['', '弱', '中', '强']
  const strengthColors = ['', '#dc2626', '#d97706', '#16a34a']

  // 生成满足 AD 复杂度要求的 12 位随机密码（大小写+数字+符号，避开易混淆字符）
  const genRandomPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lower = 'abcdefghijkmnpqrstuvwxyz'
    const digits = '23456789'
    const symbols = '!@#$%^&*'
    const all = upper + lower + digits + symbols
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
    const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)]
    while (chars.length < 12) chars.push(pick(all))
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]]
    }
    const pwd = chars.join('')
    setPassword(pwd)
    setConfirmPassword(pwd)
  }

  const handleConfirm = () => {
    if (!password) {
      message.error('请输入新密码')
      return
    }
    if (password.length < 8) {
      message.error('密码长度不能少于 8 位')
      return
    }
    if (password !== confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }
    onConfirm(password, forceChange)
  }

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 600 }}>修改密码 — {username} ({displayName})</span>}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="ok" type="primary" onClick={handleConfirm}>确认修改</Button>,
      ]}
      width={400}
    >
      <div style={{ marginTop: 8 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 5, fontWeight: 500 }}>新密码</label>
          <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} />
          {password && (
            <div style={{ fontSize: 10, color: strengthColors[strength], marginTop: 3 }}>
              密码强度：{strengthLabels[strength]}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 5, fontWeight: 500 }}>确认密码</label>
          <Input.Password value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Checkbox checked={forceChange} onChange={(e) => setForceChange(e.target.checked)}>
            <span style={{ fontSize: 12 }}>强制下次登录修改</span>
          </Checkbox>
          <Button size="small" onClick={genRandomPassword} style={{ fontSize: 12 }}>随机密码</Button>
        </div>
      </div>
    </Modal>
  )
}

export default ChangePasswordModal
