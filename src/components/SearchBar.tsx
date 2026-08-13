import React, { useState } from 'react'
import { Input, Button } from 'antd'

interface SearchBarProps {
  onSearch?: (keyword: string) => void
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [keyword, setKeyword] = useState('')

  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Input
          placeholder="搜索用户名、姓名、邮箱、部门..."
          value={keyword} onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => onSearch?.(keyword)}
          style={{ flex: 1 }} allowClear
        />
        <Button type="primary" onClick={() => onSearch?.(keyword)}>搜索</Button>
      </div>
    </div>
  )
}

export default SearchBar
