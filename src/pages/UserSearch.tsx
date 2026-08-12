import React from 'react'
import TopBar from '../components/TopBar'
import SearchBar from '../components/SearchBar'
const UserSearch: React.FC = () => (<><TopBar title="搜索用户" /><SearchBar /><div style={{ flex: 1, padding: 16, overflowY: 'auto' }} /></>)
export default UserSearch
