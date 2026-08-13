import React, { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import UserSearch from './pages/UserSearch'
import BatchCreate from './pages/BatchCreate'
import BatchPassword from './pages/BatchPassword'
import BatchGroup from './pages/BatchGroup'
import BatchAttributes from './pages/BatchAttributes'
import Settings from './pages/Settings'
import Logs from './pages/Logs'

const App: React.FC = () => {
  // 禁用 WebView 默认右键菜单（复制/检查等无实际功能的项，含输入框）；
  // 用户搜索表格行的自定义右键菜单为程序自绘，不受影响
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', handler)
    return () => document.removeEventListener('contextmenu', handler)
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<UserSearch />} />
          <Route path="/batch-create" element={<BatchCreate />} />
          <Route path="/batch-password" element={<BatchPassword />} />
          <Route path="/batch-group" element={<BatchGroup />} />
          <Route path="/batch-attributes" element={<BatchAttributes />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<Logs />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
