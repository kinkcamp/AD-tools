import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles/global.css'

// 全局错误浮层：桌面应用无法打开控制台，运行时 JS 错误直接显示在界面上便于排查
const showFatalError = (title: string, detail: unknown) => {
  const msg = detail instanceof Error ? `${detail.message}\n${detail.stack ?? ''}` : String(detail)
  console.error(title, detail)
  let el = document.getElementById('fatal-error-overlay')
  if (!el) {
    el = document.createElement('div')
    el.id = 'fatal-error-overlay'
    el.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;' +
      'background:#fff1f0;border:1px solid #dc2626;border-radius:8px;padding:12px 16px;' +
      'font-size:12px;color:#a8071a;max-height:40vh;overflow:auto;white-space:pre-wrap;box-shadow:0 4px 16px rgba(0,0,0,.15)'
    document.body.appendChild(el)
  }
  const line = document.createElement('div')
  line.textContent = `[${new Date().toLocaleTimeString()}] ${title}: ${msg}`
  line.style.marginTop = el.childElementCount > 0 ? '8px' : '0'
  el.appendChild(line)
}
window.addEventListener('error', (e) => showFatalError('运行时错误', e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => showFatalError('未处理的Promise拒绝', e.reason))

class FatalBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: React.ErrorInfo) { showFatalError('页面渲染错误', `${error.message}\n${info.componentStack ?? ''}`) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontSize: 13, color: '#dc2626' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>页面发生错误，请查看底部错误详情</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}

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
      <FatalBoundary>
        <App />
      </FatalBoundary>
    </ConfigProvider>
  </React.StrictMode>,
)
