import React, { useState } from 'react'
import { Modal, Input, Checkbox, Button } from 'antd'

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

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 600 }}>修改密码 — {username} ({displayName})</span>}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="ok" type="primary" onClick={() => onConfirm(password, forceChange)}>确认修改</Button>,
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
        <div style={{ marginBottom: 10 }}>
          <Checkbox checked={forceChange} onChange={(e) => setForceChange(e.target.checked)}>
            <span style={{ fontSize: 12 }}>强制下次登录修改</span>
          </Checkbox>
        </div>
        <div>
          <Checkbox>
            <span style={{ fontSize: 12 }}>生成随机密码</span>
          </Checkbox>
        </div>
      </div>
    </Modal>
  )
}

export default ChangePasswordModal
