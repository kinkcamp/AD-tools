# AD 域控助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an enterprise AD domain controller assistant desktop app with Tauri + React + TypeScript, strictly following the approved minimalist UI prototypes.

**Architecture:** Tauri 2.x desktop app. React 18 + TypeScript frontend with Ant Design 5.x (custom minimalist light theme). Rust backend using `ldap3` crate for LDAP operations, `csv` + `calamine` for file parsing. Frontend communicates with Rust via Tauri IPC (`invoke`).

**Tech Stack:** Tauri 2.x, React 18, TypeScript, Vite, Ant Design 5.x, Rust, ldap3, csv, calamine, serde

**Spec:** `docs/superpowers/specs/2026-08-12-ad-assistant-design.md`

---

## File Structure

```
ADtools/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root with router
│   ├── styles/
│   │   └── global.css            # Global styles (minimalist theme)
│   ├── components/
│   │   ├── AppLayout.tsx         # Main layout (sidebar + content)
│   │   ├── Sidebar.tsx           # Sidebar navigation
│   │   ├── TopBar.tsx            # Top title bar
│   │   ├── SearchBar.tsx         # Global search bar
│   │   ├── StatsRow.tsx          # Statistics cards row
│   │   ├── UploadZone.tsx        # File upload drop zone
│   │   └── StepsBar.tsx          # Step indicator
│   ├── pages/
│   │   ├── UserSearch.tsx        # Page 1: User search & management
│   │   ├── BatchCreate.tsx       # Page 2: Batch create users
│   │   ├── BatchPassword.tsx     # Page 3: Batch modify passwords
│   │   ├── BatchGroup.tsx        # Page 4: Batch add to groups
│   │   ├── BatchAttributes.tsx   # Page 5: Batch modify attributes
│   │   ├── Settings.tsx          # Page 7: Connection settings
│   │   └── modals/
│   │       └── ChangePasswordModal.tsx  # Page 6: Double-click password modal
│   ├── services/
│   │   └── tauri.ts              # Tauri IPC wrapper functions
│   └── types/
│       └── index.ts              # TypeScript type definitions
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs               # Tauri entry point
│       ├── lib.rs                # Command registration
│       ├── config.rs             # Config management
│       ├── ldap_client.rs        # LDAP connection & operations
│       └── file_parser.rs        # CSV/Excel parsing
└── package.json
```

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Tauri + React + TypeScript Project

**Files:**
- Create: entire project scaffold

- [ ] **Step 1: Create Vite + React + TypeScript project**

```bash
cd /Users/zhaozonggao/Workbuddy/ADtools
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Add Tauri CLI and initialize**

```bash
npm install
npm install @tauri-apps/cli@latest --save-dev
npx tauri init
```

When prompted:
- App name: `AD域控助手`
- Window title: `AD 域控助手`
- Web assets relative path: `../dist`
- Dev server URL: `http://localhost:5173`
- Frontend dev command: `npm run dev`
- Frontend build command: `npm run build`

- [ ] **Step 3: Install UI dependencies**

```bash
npm install antd @ant-design/icons react-router-dom
npm install xlsx papaparse
npm install -D @types/papaparse
```

- [ ] **Step 4: Verify project builds**

```bash
npm run dev
```

Expected: Vite dev server starts at http://localhost:5173

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: initialize Tauri + React + TypeScript project"
```

---

### Task 2: Configure Ant Design Minimalist Theme

**Files:**
- Create: `src/styles/global.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create global CSS**

Create `src/styles/global.css`:

```css
:root {
  --color-bg: #ffffff;
  --color-bg-sidebar: #fafafa;
  --color-bg-input: #f5f5f5;
  --color-border: #e5e5e5;
  --color-divider: #eeeeee;
  --color-text: #1a1a1a;
  --color-text-secondary: #666666;
  --color-text-hint: #999999;
  --color-primary: #1a1a1a;
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #e54d4d;
  --color-ssl: #52c41a;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'JetBrains Mono', monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 12.5px;
  -webkit-font-smoothing: antialiased;
}

#root { width: 100vw; height: 100vh; overflow: hidden; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #d0d0d0; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #bbb; }
```

- [ ] **Step 2: Update main.tsx with Ant Design ConfigProvider**

Replace `src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1a1a1a',
          colorSuccess: '#16a34a',
          colorWarning: '#d97706',
          colorError: '#e54d4d',
          borderRadius: 5,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
          fontSize: 12,
          colorBgContainer: '#ffffff',
          colorBgLayout: '#f5f5f5',
          colorBorder: '#e5e5e5',
          colorText: '#1a1a1a',
          colorTextSecondary: '#666666',
        },
        components: {
          Table: {
            headerBg: '#fafafa',
            rowHoverBg: '#fafafa',
            borderColor: '#eeeeee',
            cellPaddingBlock: 9,
            cellPaddingInline: 14,
            headerColor: '#999999',
            fontSize: 12,
          },
          Button: { borderRadius: 5, controlHeight: 30 },
          Input: { colorBgContainer: '#f5f5f5', activeBorderColor: '#1a1a1a', borderRadius: 6, controlHeight: 34 },
          Select: { colorBgContainer: '#f5f5f5', borderRadius: 6, controlHeight: 34 },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: configure Ant Design minimalist theme"
```

---

## Phase 2: App Shell & Layout

### Task 3: Create Sidebar Component

**Files:**
- Create: `src/components/Sidebar.tsx`

- [ ] **Step 1: Create Sidebar**

Create `src/components/Sidebar.tsx`:

```tsx
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const navConfig = [
  {
    group: '用户管理',
    items: [{ key: '/', label: '搜索用户', icon: '⌕' }],
  },
  {
    group: '批量操作',
    items: [
      { key: '/batch-create', label: '批量创建用户', icon: '+' },
      { key: '/batch-password', label: '批量修改密码', icon: '⚿' },
      { key: '/batch-group', label: '批量加入组', icon: '⊞' },
      { key: '/batch-attributes', label: '批量修改属性', icon: '✎' },
    ],
  },
  {
    group: '系统',
    items: [
      { key: '/settings', label: '连接设置', icon: '⚙' },
      { key: '/logs', label: '操作日志', icon: '☰' },
    ],
  },
]

const Sidebar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div style={{
      width: 200, background: '#fafafa', borderRight: '1px solid #eee',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%',
    }}>
      <div style={{ padding: '18px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, background: '#1a1a1a', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 11, fontWeight: 700,
        }}>AD</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>域控助手</span>
      </div>
      <div style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
        {navConfig.map((group) => (
          <div key={group.group} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#999', padding: '6px 10px', letterSpacing: 0.8, fontWeight: 500 }}>
              {group.group}
            </div>
            {group.items.map((item) => {
              const isActive = location.pathname === item.key
              return (
                <div key={item.key} onClick={() => navigate(item.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                  borderRadius: 5, cursor: 'pointer', fontSize: 12.5, transition: 'all 0.1s',
                  color: isActive ? '#1a1a1a' : '#666',
                  background: isActive ? '#f0f0f0' : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#f0f0f0' }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 14, width: 18, textAlign: 'center', opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                  {item.label}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#52c41a', fontWeight: 500 }}>
          <div style={{ width: 6, height: 6, background: '#52c41a', borderRadius: '50%' }} />
          SSL 已连接
        </div>
      </div>
    </div>
  )
}

export default Sidebar
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add Sidebar component"
```

---

### Task 4: Create TopBar and SearchBar

**Files:**
- Create: `src/components/TopBar.tsx`
- Create: `src/components/SearchBar.tsx`

- [ ] **Step 1: Create TopBar**

```tsx
// src/components/TopBar.tsx
import React from 'react'

interface TopBarProps {
  title: string
  actions?: React.ReactNode
}

const TopBar: React.FC<TopBarProps> = ({ title, actions }) => (
  <div style={{
    height: 48, borderBottom: '1px solid #eee', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
    padding: '0 20px', flexShrink: 0,
  }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', letterSpacing: -0.2 }}>{title}</span>
    <div style={{ display: 'flex', gap: 6 }}>{actions}</div>
  </div>
)

export default TopBar
```

- [ ] **Step 2: Create SearchBar**

```tsx
// src/components/SearchBar.tsx
import React, { useState } from 'react'
import { Input, Select, Button } from 'antd'

interface SearchBarProps {
  onSearch?: (keyword: string, ou: string) => void
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [keyword, setKeyword] = useState('')
  const [ou, setOu] = useState('')

  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Input
          placeholder="搜索用户名、姓名、邮箱、部门..."
          value={keyword} onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => onSearch?.(keyword, ou)}
          style={{ flex: 1 }} allowClear
        />
        <Select value={ou} onChange={setOu} style={{ width: 140 }} options={[
          { value: '', label: '全部 OU' },
          { value: 'OU=销售部', label: 'OU=销售部' },
          { value: 'OU=技术部', label: 'OU=技术部' },
          { value: 'OU=人事部', label: 'OU=人事部' },
          { value: 'OU=财务部', label: 'OU=财务部' },
        ]} />
        <Button type="primary" onClick={() => onSearch?.(keyword, ou)}>搜索</Button>
      </div>
    </div>
  )
}

export default SearchBar
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TopBar.tsx src/components/SearchBar.tsx
git commit -m "feat: add TopBar and SearchBar"
```

---

### Task 5: Create AppLayout, Router, and Placeholder Pages

**Files:**
- Create: `src/components/AppLayout.tsx`
- Modify: `src/App.tsx`
- Create: all 6 page files under `src/pages/`

- [ ] **Step 1: Create AppLayout**

```tsx
// src/components/AppLayout.tsx
import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

const AppLayout: React.FC = () => (
  <div style={{ display: 'flex', height: '100vh', background: '#fff', overflow: 'hidden' }}>
    <Sidebar />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Outlet />
    </div>
  </div>
)

export default AppLayout
```

- [ ] **Step 2: Update App.tsx**

```tsx
// src/App.tsx
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
```

- [ ] **Step 3: Create placeholder pages**

Each page follows this minimal pattern (create all 6):

```tsx
// src/pages/UserSearch.tsx
import React from 'react'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
const UserSearch: React.FC = () => (<><TopBar title="搜索用户" /><SearchBar /><div style={{ flex: 1, padding: 16, overflowY: 'auto' }} /></>)
export default UserSearch
```

```tsx
// src/pages/BatchCreate.tsx
import React from 'react'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import { Button } from 'antd'
const BatchCreate: React.FC = () => (<><TopBar title="批量创建用户" actions={<Button size="small">下载模板</Button>} /><SearchBar /><div style={{ flex: 1, padding: 16, overflowY: 'auto' }} /></>)
export default BatchCreate
```

```tsx
// src/pages/BatchPassword.tsx
import React from 'react'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import { Button } from 'antd'
const BatchPassword: React.FC = () => (<><TopBar title="批量修改密码" actions={<Button size="small">下载模板</Button>} /><SearchBar /><div style={{ flex: 1, padding: 16, overflowY: 'auto' }} /></>)
export default BatchPassword
```

```tsx
// src/pages/BatchGroup.tsx
import React from 'react'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import { Button } from 'antd'
const BatchGroup: React.FC = () => (<><TopBar title="批量加入组" actions={<Button size="small">下载模板</Button>} /><SearchBar /><div style={{ flex: 1, padding: 16, overflowY: 'auto' }} /></>)
export default BatchGroup
```

```tsx
// src/pages/BatchAttributes.tsx
import React from 'react'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import { Button } from 'antd'
const BatchAttributes: React.FC = () => (<><TopBar title="批量修改属性" actions={<Button size="small">下载模板</Button>} /><SearchBar /><div style={{ flex: 1, padding: 16, overflowY: 'auto' }} /></>)
export default BatchAttributes
```

```tsx
// src/pages/Settings.tsx
import React from 'react'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
import { Button } from 'antd'
const Settings: React.FC = () => (<><TopBar title="连接设置" actions={<><Button size="small">测试连接</Button><Button type="primary" size="small">保存配置</Button></>} /><SearchBar /><div style={{ flex: 1, padding: 16, overflowY: 'auto' }} /></>)
export default Settings
```

- [ ] **Step 4: Verify app compiles and routing works**

```bash
npm run dev
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add AppLayout, router, placeholder pages"
```

---

## Phase 3: Common Components

### Task 6: Create StatsRow, UploadZone, StepsBar

**Files:**
- Create: `src/components/StatsRow.tsx`
- Create: `src/components/UploadZone.tsx`
- Create: `src/components/StepsBar.tsx`

- [ ] **Step 1: Create StatsRow**

```tsx
// src/components/StatsRow.tsx
import React from 'react'

interface StatItem { label: string; value: number | string }
interface StatsRowProps { items: StatItem[] }

const StatsRow: React.FC<StatsRowProps> = ({ items }) => (
  <div style={{ display: 'flex', gap: 1, marginBottom: 16, background: '#eee', borderRadius: 8, overflow: 'hidden' }}>
    {items.map((item) => (
      <div key={item.label} style={{ flex: 1, background: '#fff', padding: '12px 16px' }}>
        <div style={{ fontSize: 10, color: '#999', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a', letterSpacing: -0.5 }}>{item.value}</div>
      </div>
    ))}
  </div>
)

export default StatsRow
```

- [ ] **Step 2: Create UploadZone**

```tsx
// src/components/UploadZone.tsx
import React, { useCallback } from 'react'

interface UploadZoneProps {
  onFileSelect?: (file: File) => void
  accept?: string
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, accept = '.csv,.xlsx,.xls' }) => {
  const handleClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) onFileSelect?.(file)
    }
    input.click()
  }, [onFileSelect, accept])

  return (
    <div onClick={handleClick} style={{
      border: '1.5px dashed #e0e0e0', borderRadius: 10, padding: 32,
      textAlign: 'center', cursor: 'pointer', marginBottom: 16, transition: 'all 0.15s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.background = '#fafafa' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.5 }}>📁</div>
      <div style={{ fontSize: 13, color: '#333', marginBottom: 4, fontWeight: 500 }}>拖拽文件到此处，或点击选择</div>
      <div style={{ fontSize: 11, color: '#999' }}>支持 CSV / Excel，最大 10MB</div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
        {['.csv', '.xlsx', '.xls'].map((fmt) => (
          <span key={fmt} style={{ background: '#f5f5f5', color: '#999', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 500 }}>{fmt}</span>
        ))}
      </div>
    </div>
  )
}

export default UploadZone
```

- [ ] **Step 3: Create StepsBar**

```tsx
// src/components/StepsBar.tsx
import React from 'react'

interface Step { label: string; status: 'done' | 'active' | 'pending' }
interface StepsBarProps { steps: Step[] }

const StepsBar: React.FC<StepsBarProps> = ({ steps }) => (
  <div style={{ display: 'flex', marginBottom: 16 }}>
    {steps.map((step, i) => {
      const numBg = step.status === 'done' ? '#52c41a' : step.status === 'active' ? '#1a1a1a' : '#f0f0f0'
      const numColor = step.status === 'pending' ? '#999' : '#fff'
      const labelColor = step.status === 'active' ? '#1a1a1a' : step.status === 'done' ? '#52c41a' : '#999'
      return (
        <div key={i} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', background: numBg,
            color: numColor, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 11, fontWeight: 600, marginBottom: 4,
          }}>{step.status === 'done' ? '✓' : i + 1}</div>
          <div style={{ fontSize: 10, color: labelColor, fontWeight: step.status === 'active' ? 500 : 400 }}>{step.label}</div>
          {i < steps.length - 1 && (
            <div style={{ position: 'absolute', top: 12, left: '60%', right: '-40%', height: 1, background: step.status === 'done' ? '#52c41a' : '#eee' }} />
          )}
        </div>
      )
    })}
  </div>
)

export default StepsBar
```

- [ ] **Step 4: Commit**

```bash
git add src/components/StatsRow.tsx src/components/UploadZone.tsx src/components/StepsBar.tsx
git commit -m "feat: add StatsRow, UploadZone, StepsBar"
```

---

## Phase 4: Pages (Strict UI)

### Task 7: Page 1 — UserSearch

**Files:**
- Create: `src/types/index.ts`
- Modify: `src/pages/UserSearch.tsx`

- [ ] **Step 1: Create types**

```ts
// src/types/index.ts
export interface ADUser {
  dn: string
  sAMAccountName: string
  displayName: string
  mail: string
  department: string
  status: 'active' | 'disabled' | 'locked'
  lastLogin: string
}

export interface AppConfig {
  ldapHost: string
  ldapPort: number
  baseDN: string
  bindDN: string
  bindPassword: string
  sslEnabled: boolean
  startTls: boolean
  verifyCert: boolean
  caCertPath: string
  ldapVersion: string
}

export interface BatchResult {
  total: number
  success: number
  failed: number
  details: { username: string; success: boolean; message: string }[]
}
```

- [ ] **Step 2: Implement UserSearch page**

Full implementation with mock data, StatsRow, Table with status badges, pagination, and double-click handler. Follow the prototype exactly: stats row (搜索结果/活跃/已禁用/已锁定), table columns (用户名/姓名/邮箱/部门/状态/最后登录), pagination (显示 1-5 / 共 128 条).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: implement UserSearch page"
```

### Task 8: Page 2 — BatchCreate

**Files:**
- Modify: `src/pages/BatchCreate.tsx`

StepsBar (4 steps) + template download cards (CSV/Excel) + UploadZone + preview table (#/用户名/姓名/OU路径/邮箱/状态 with pass/warn badges).

- [ ] **Step 1: Implement and commit**

```bash
git add src/pages/BatchCreate.tsx
git commit -m "feat: implement BatchCreate page"
```

### Task 9: Page 3 — BatchPassword

**Files:**
- Modify: `src/pages/BatchPassword.tsx`

Password strategy card (密码模式 Select + 密码长度 Input + Checkboxes) + UploadZone + progress card (进度条 + 统计) + log panel (monospace, colored lines).

- [ ] **Step 1: Implement and commit**

```bash
git add src/pages/BatchPassword.tsx
git commit -m "feat: implement BatchPassword page"
```

### Task 10: Page 4 — BatchGroup

**Files:**
- Modify: `src/pages/BatchGroup.tsx`

Target group card (搜索 Input + 已选组 tags with × remove) + UploadZone + preview table (#/用户名/姓名/当前所属组/操作 with 已在组/将加入 badges).

- [ ] **Step 1: Implement and commit**

```bash
git add src/pages/BatchGroup.tsx
git commit -m "feat: implement BatchGroup page"
```

### Task 11: Page 5 — BatchAttributes

**Files:**
- Modify: `src/pages/BatchAttributes.tsx`

Attribute selection card (属性字段 Select + 修改方式 Select + 新值 Input) + multi-attribute rules card (dynamic add/remove rules with Select + Input + 移除 button) + UploadZone + preview table with old/new value comparison (green highlighted new values).

- [ ] **Step 1: Implement and commit**

```bash
git add src/pages/BatchAttributes.tsx
git commit -m "feat: implement BatchAttributes page"
```

### Task 12: Page 6 — ChangePasswordModal

**Files:**
- Create: `src/pages/modals/ChangePasswordModal.tsx`
- Modify: `src/pages/UserSearch.tsx` (wire double-click → modal)

Modal with: 新密码 Input.Password + 密码强度 indicator + 确认密码 + 强制下次登录修改 Checkbox + 生成随机密码 Checkbox.

- [ ] **Step 1: Implement and commit**

```bash
git add -A
git commit -m "feat: add ChangePasswordModal"
```

### Task 13: Page 7 — Settings

**Files:**
- Modify: `src/pages/Settings.tsx`

4 form cards: AD域控连接 (地址+端口+BaseDN+协议版本) + 身份验证 (绑定DN+密码+确认密码) + SSL/TLS (3个Switch开关+CA证书路径) + 连接测试 (状态+延迟+域信息).

- [ ] **Step 1: Implement and commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: implement Settings page"
```

---

## Phase 5: Rust Backend

### Task 14: Config Management Module

**Files:**
- Create: `src-tauri/src/config.rs`

JSON-based config stored in app data directory. Fields match `AppConfig` type.

- [ ] **Step 1: Implement config load/save with serde**
- [ ] **Step 2: Add Tauri commands: `get_config`, `save_config`, `test_connection`**
- [ ] **Step 3: Commit**

### Task 15: LDAP Client Module

**Files:**
- Create: `src-tauri/src/ldap_client.rs`

Core LDAP operations using `ldap3` crate with SSL/TLS support.

- [ ] **Step 1: Implement connection management (connect, disconnect, SSL)**
- [ ] **Step 2: Implement user search (by keyword, OU filter)**
- [ ] **Step 3: Implement user CRUD (create, modify, delete)**
- [ ] **Step 4: Implement password change (unicodePwd encoding)**
- [ ] **Step 5: Implement group operations (add/remove member)**
- [ ] **Step 6: Commit**

### Task 16: File Parser Module

**Files:**
- Create: `src-tauri/src/file_parser.rs`

Parse CSV and Excel files for batch operations.

- [ ] **Step 1: Implement CSV parsing with `csv` crate**
- [ ] **Step 2: Implement Excel parsing with `calamine` crate**
- [ ] **Step 3: Implement data validation**
- [ ] **Step 4: Implement template generation**
- [ ] **Step 5: Commit**

---

## Phase 6: Integration

### Task 17: Wire Frontend to Backend

**Files:**
- Create: `src/services/tauri.ts`
- Modify: all page files to use real Tauri commands

- [ ] **Step 1: Create Tauri IPC wrapper**
- [ ] **Step 2: Replace mock data with real commands**
- [ ] **Step 3: End-to-end testing**
- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: wire frontend to Rust backend"
```
