import React, { useState } from 'react'
import { Input, Select, Switch, Button } from 'antd'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'

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

const Settings: React.FC = () => {
  const [sslEnabled, setSslEnabled] = useState(true)
  const [startTls, setStartTls] = useState(false)
  const [verifyCert, setVerifyCert] = useState(true)

  return (
    <>
      <TopBar
        title="连接设置"
        actions={
          <>
            <Button size="small" ghost>测试连接</Button>
            <Button type="primary" size="small">保存配置</Button>
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
              <Input defaultValue="ldap://dc01.company.com" style={{ fontSize: 12, background: '#f5f5f5' }} />
            </div>
            <div style={{ width: 100 }}>
              <label style={labelStyle}>端口</label>
              <Input defaultValue="636" style={{ fontSize: 12, background: '#f5f5f5' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Base DN</label>
              <Input defaultValue="DC=company,DC=com" style={{ fontSize: 12, background: '#f5f5f5' }} />
            </div>
            <div style={{ width: 140 }}>
              <label style={labelStyle}>协议版本</label>
              <Select defaultValue="v3" style={{ width: '100%', fontSize: 12 }}>
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
            <Input defaultValue="CN=admin,OU=Admins,DC=company,DC=com" style={{ fontSize: 12, background: '#f5f5f5' }} />
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>密码</label>
              <Input.Password style={{ fontSize: 12, background: '#f5f5f5' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>确认密码</label>
              <Input.Password style={{ fontSize: 12, background: '#f5f5f5' }} />
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
            <Switch checked={sslEnabled} onChange={setSslEnabled} size="small" />
          </div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>STARTTLS</div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>在普通连接上升级到 TLS</div>
            </div>
            <Switch checked={startTls} onChange={setStartTls} size="small" />
          </div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>验证服务器证书</div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>校验 CA 证书是否有效</div>
            </div>
            <Switch checked={verifyCert} onChange={setVerifyCert} size="small" />
          </div>
          <div>
            <label style={labelStyle}>CA 证书路径</label>
            <Input defaultValue="/etc/ssl/certs/ca-cert.pem" style={{ fontSize: 12, background: '#f5f5f5' }} />
          </div>
        </div>

        {/* 连接测试 */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>连接测试</div>
          <div style={{ color: '#16a34a', fontWeight: 500, fontSize: 12, marginBottom: 4 }}>
            ✓ 连接成功
          </div>
          <div style={{ color: '#999', fontSize: 10, marginBottom: 8 }}>
            12ms · dc01.company.com · LDAP v3 + SSL
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>
            <div>域功能级别: Windows Server 2016</div>
            <div>域名称: company.com</div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Settings
