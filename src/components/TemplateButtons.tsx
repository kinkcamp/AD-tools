import React from 'react'
import { downloadTemplate } from '../utils/template'

// 紧凑型统一模板下载入口，用于批量改密/加组/改属性页面
// 模板为全部批量功能通用，各功能只读取自己需要的列
const TemplateButtons: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
    <span style={{ fontSize: 11, color: '#999' }}>统一模板（各功能只读取所需列）:</span>
    <a onClick={() => downloadTemplate('csv')} style={{ fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
      下载 CSV
    </a>
    <a onClick={() => downloadTemplate('xlsx')} style={{ fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>
      下载 Excel
    </a>
  </div>
)

export default TemplateButtons
