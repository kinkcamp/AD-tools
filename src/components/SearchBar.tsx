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
