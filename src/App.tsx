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

    // 文本选中限制：只允许在单个表格单元格内选中，
    // 跨单元格/跨元素的拖选一旦产生立即收起，避免大段误选
    const cellOf = (node: Node | null): Element | null => {
      const el = node instanceof Element ? node : node?.parentElement ?? null
      return el?.closest('td.ant-table-cell') ?? null
    }
    const onSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      const startCell = cellOf(range.startContainer)
      const endCell = cellOf(range.endContainer)
      if (!startCell || !endCell || startCell !== endCell) sel.collapseToStart()
    }
    document.addEventListener('selectionchange', onSelectionChange)

    return () => {
      document.removeEventListener('contextmenu', handler)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
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
