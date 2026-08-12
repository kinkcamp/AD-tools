import React, { useState, useEffect } from 'react'
import { Input, Select, Switch, Button, message } from 'antd'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import { tauriService } from '../services/tauri'
import type { AppConfig } from '../types'

const cardStyle: React.CSSProperties = {
  border: '1px solid #eee',
  borderRadius: 8,
  padding: 16,
  marginBottom: 14,
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
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
  ldapHost: '',
  ldapPort: 636,
  baseDN: '',
  bindDN: '',
  bindPassword: '',
  sslEnabled: true,
  startTls: false,
  verifyCert: true,
  caCertPath: '',
  ldapVersion: 'v3',
}

const Settings: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    tauriService.getConfig().then(cfg => {
      if (cfg.ldapHost) setConfig(cfg)
    }).catch(() => {})
  }, [])

  const update = (field: keyof AppConfig, value: string | number | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
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

  return (
    <>
      <TopBar
        title="连接设置"
        actions={
          <>
            <Button size="small" ghost onClick={handleTest} loading={testing}>测试连接</Button>
            <Button type="primary" size="small" onClick={handleSave} loading={saving} style={{ background: '#1a1a1a' }}>保存配置</Button>
          </>
        }
      />
      <SearchBar />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        {/* AD 域控连接 */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>AD 域控连接</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>域控制器地址</label>
              <Input
                value={config.ldapHost}
                onChange={(e) => update('ldapHost', e.target.value)}
                placeholder="ldap://dc01.company.com"
                style={{ fontSize: 12, background: '#f5f5f5' }}
              />
            </div>
            <div style={{ width: 100 }}>
              <label style={labelStyle}>端口</label>
              <Input
                type="number"
                value={config.ldapPort}
                onChange={(e) => update('ldapPort', Number(e.target.value))}
                style={{ fontSize: 12, background: '#f5f5f5' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Base DN</label>
              <Input
                value={config.baseDN}
                onChange={(e) => update('baseDN', e.target.value)}
                placeholder="DC=company,DC=com"
                style={{ fontSize: 12, background: '#f5f5f5' }}
              />
            </div>
            <div style={{ width: 140 }}>
              <label style={labelStyle}>协议版本</label>
              <Select value={config.ldapVersion} onChange={(v) => update('ldapVersion', v)} style={{ width: '100%', fontSize: 12 }}>
                <Select.Option value="v3">LDAP v3</Select.Option>
                <Select.Option value="v2">LDAP v2</Select.Option>
              </Select>
            </div>
          </div>
        </div>

        {/* 身份验证 */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>身份验证</div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>绑定 DN</label>
            <Input
              value={config.bindDN}
              onChange={(e) => update('bindDN', e.target.value)}
              placeholder="CN=admin,OU=Admins,DC=company,DC=com"
              style={{ fontSize: 12, background: '#f5f5f5' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>密码</label>
              <Input.Password
                value={config.bindPassword}
                onChange={(e) => update('bindPassword', e.target.value)}
                style={{ fontSize: 12, background: '#f5f5f5' }}
              />
            </div>
          </div>
        </div>

        {/* SSL / TLS */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>SSL / TLS</div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>启用 SSL 安全连接</div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>使用 LDAPS (端口 636) 加密通信</div>
            </div>
            <Switch checked={config.sslEnabled} onChange={(v) => update('sslEnabled', v)} size="small" />
          </div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>STARTTLS</div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>在普通连接上升级到 TLS</div>
            </div>
            <Switch checked={config.startTls} onChange={(v) => update('startTls', v)} size="small" />
          </div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>验证服务器证书</div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>校验 CA 证书是否有效</div>
            </div>
            <Switch checked={config.verifyCert} onChange={(v) => update('verifyCert', v)} size="small" />
          </div>
          <div>
            <label style={labelStyle}>CA 证书路径</label>
            <Input
              value={config.caCertPath}
              onChange={(e) => update('caCertPath', e.target.value)}
              placeholder="/etc/ssl/certs/ca-cert.pem"
              style={{ fontSize: 12, background: '#f5f5f5' }}
            />
          </div>
        </div>

        {/* 连接测试 */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>连接测试</div>
          {testResult ? (
            testResult.success ? (
              <>
                <div style={{ color: '#16a34a', fontWeight: 500, fontSize: 12, marginBottom: 4 }}>
                  ✓ 连接成功
                </div>
                <div style={{ color: '#666', fontSize: 11 }}>
                  {testResult.message}
                </div>
              </>
            ) : (
              <>
                <div style={{ color: '#e54d4d', fontWeight: 500, fontSize: 12, marginBottom: 4 }}>
                  ✗ 连接失败
                </div>
                <div style={{ color: '#666', fontSize: 11 }}>
                  {testResult.message}
                </div>
              </>
            )
          ) : (
            <div style={{ color: '#999', fontSize: 11 }}>
              配置完成后点击顶部「测试连接」按钮验证
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default Settings
