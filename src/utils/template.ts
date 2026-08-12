// 所有批量操作共用的统一文件模板：
// 各功能只读取自己需要的列，其余列忽略
//   批量创建   : sAMAccountName + displayName/ou/password/mail/department/title/telephoneNumber/description/userPrincipalName/givenName/sn
//   批量改密   : sAMAccountName + password
//   批量加组   : sAMAccountName
//   批量改属性 : sAMAccountName + 要修改的属性列（模板中的 mail/department/title/telephoneNumber 等即为示例）

export const TEMPLATE_HEADERS = [
  'sAMAccountName', 'displayName', 'ou', 'password', 'mail', 'department', 'title',
  'telephoneNumber', 'description', 'userPrincipalName', 'givenName', 'sn',
]

export const TEMPLATE_EXAMPLE = [
  'zhangsan', '张三', 'CN=Users,DC=company,DC=com', 'Init@2026', 'zhangsan@company.com',
  '技术部', '工程师', '13800138000', '', 'zhangsan@company.com', '三', '张',
]

// CSV 字段转义：含逗号/引号的值（如 DN）必须加引号
const csvField = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

export const downloadTemplate = (format: 'csv' | 'xlsx') => {
  if (format === 'csv') {
    const content = '\ufeff' + [
      TEMPLATE_HEADERS.join(','),
      TEMPLATE_EXAMPLE.map(csvField).join(','),
    ].join('\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'user_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  } else {
    // Excel 模板通过 xlsx 库动态导入生成，避免计入首屏包体
    import('xlsx').then((XLSX) => {
      const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'users')
      XLSX.writeFile(wb, 'user_template.xlsx')
    })
  }
}
