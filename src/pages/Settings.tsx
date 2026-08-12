import React, { useState, useEffect } from 'react'
import { Input, Button, message } from 'antd'
import TopBar from '../components/TopBar'
import { tauriService } from '../services/tauri'
import type { AppConfig } from '../types'

const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 8,
  padding: 16,
  marginBottom: 14,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#666',
  marginBottom: 5,
  fontWeight: 500,
}

const defaultConfig: AppConfig = {
  server: '',
  domain: '',
  username: '',
  password: '',
}

const Settings: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    tauriService.getConfig().then(cfg => {
      if (cfg.server || cfg.domain) setConfig(cfg)
    }).catch(() => {})
  }, [])

  const update = (field: keyof AppConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!config.server || !config.domain || !config.username || !config.password) {
      message.warning('请填写所有必填项')
      return
    }
    setSaving(true)
    try {
      await tauriService.saveConfig(config)
      message.success('配置已保存')
    } catch (err) {
      message.error(`保存失败: ${err}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!config.server || !config.domain || !config.username || !config.password) {
      message.warning('请先填写所有配置项')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await tauriService.testConnection(config)
      setTestResult({ success: true, message: result })
      message.success('连接测试成功')
    } catch (err) {
      setTestResult({ success: false, message: String(err) })
      message.error(`连接测试失败: ${err}`)
    } finally {
      setTesting(false)
    }
  }

  // Auto-preview derived values
  const derivedBaseDN = config.domain
    ? config.domain.split('.').filter(Boolean).map(p => `DC=${p}`).join(',')
    : '—'
  const derivedBindDN = config.username
    ? (config.username.includes('=') || config.username.includes('@')
        ? config.username
        : config.domain ? `${config.username}@${config.domain}` : '—')
    : '—'

  return (
    <>
      <TopBar
        title="连接设置"
        actions={
          <Button type="primary" size="small" onClick={handleSave} loading={saving} style={{ background: '#1a1a1a' }}>保存配置</Button>
        }
      />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        {/* 连接配置 */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 14, color: '#1a1a1a' }}>AD 域控连接</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>服务器地址 <span style={{ color: '#e54d4d' }}>*</span></label>
              <Input
                value={config.server}
                onChange={(e) => update('server', e.target.value)}
                placeholder="例如: dc01.company.com 或 192.168.1.100"
                style={{ fontSize: 12, background: '#f5f5f5' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>域名 <span style={{ color: '#e54d4d' }}>*</span></label>
              <Input
                value={config.domain}
                onChange={(e) => update('domain', e.target.value)}
                placeholder="例如: company.com"
                style={{ fontSize: 12, background: '#f5f5f5' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>账户 <span style={{ color: '#e54d4d' }}>*</span></label>
              <Input
                value={config.username}
                onChange={(e) => update('username', e.target.value)}
                placeholder="例如: admin 或 CN=admin,DC=company,DC=com"
                style={{ fontSize: 12, background: '#f5f5f5' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>密码 <span style={{ color: '#e54d4d' }}>*</span></label>
              <Input.Password
                value={config.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="输入密码"
                style={{ fontSize: 12, background: '#f5f5f5' }}
              />
            </div>
          </div>
        </div>

        {/* 测试连接按钮 + 结果 */}
        <div style={{ marginBottom: 14 }}>
          <Button onClick={handleTest} loading={testing} style={{ fontSize: 12 }}>
            测试连接
          </Button>
          {testResult && (
            <span style={{
              marginLeft: 12, fontSize: 11,
              color: testResult.success ? '#16a34a' : '#e54d4d',
              fontWeight: 500,
            }}>
              {testResult.success ? '✓' : '✗'} {testResult.message}
            </span>
          )}
        </div>

        {/* 自动推导预览 */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: '#1a1a1a' }}>自动推导参数</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>Base DN</div>
              <div style={{ fontSize: 11, color: '#1a1a1a', fontFamily: 'monospace' }}>{derivedBaseDN}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>登录身份</div>
              <div style={{ fontSize: 11, color: '#1a1a1a', fontFamily: 'monospace' }}>{derivedBindDN}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>连接方式</div>
              <div style={{ fontSize: 11, color: '#16a34a', fontFamily: 'monospace' }}>自动协商 LDAPS → StartTLS → LDAP</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Settings
