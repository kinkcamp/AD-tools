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
