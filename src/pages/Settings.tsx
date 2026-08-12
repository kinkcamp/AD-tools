import React from 'react'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import { Button } from 'antd'
const Settings: React.FC = () => (<><TopBar title="连接设置" actions={<><Button size="small">测试连接</Button><Button type="primary" size="small">保存配置</Button></>} /><SearchBar /><div style={{ flex: 1, padding: 16, overflowY: 'auto' }} /></>)
export default Settings
