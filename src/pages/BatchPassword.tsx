import React from 'react'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import { Button } from 'antd'
const BatchPassword: React.FC = () => (<><TopBar title="批量修改密码" actions={<Button size="small">下载模板</Button>} /><SearchBar /><div style={{ flex: 1, padding: 16, overflowY: 'auto' }} /></>)
export default BatchPassword
