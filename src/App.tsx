import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import UserSearch from './pages/UserSearch'
import BatchCreate from './pages/BatchCreate'
import BatchPassword from './pages/BatchPassword'
import BatchGroup from './pages/BatchGroup'
import BatchAttributes from './pages/BatchAttributes'
import Settings from './pages/Settings'

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<UserSearch />} />
        <Route path="/batch-create" element={<BatchCreate />} />
        <Route path="/batch-password" element={<BatchPassword />} />
        <Route path="/batch-group" element={<BatchGroup />} />
        <Route path="/batch-attributes" element={<BatchAttributes />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  </BrowserRouter>
)

export default App
