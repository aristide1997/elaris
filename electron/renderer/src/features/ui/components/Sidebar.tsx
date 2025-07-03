import React from 'react'
import NewChatButton from '../../conversations/components/NewChatButton'
import ChatHistoryList from '../../conversations/components/ChatHistoryList'
import SettingsButton from './SettingsButton'
import './Sidebar.css'

const Sidebar: React.FC = () => {
  return (
    <div className="sidebar-container">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Conversations</h2>
        <NewChatButton />
      </div>
      
      <div className="sidebar-content">
        <ChatHistoryList />
      </div>
      
      <div className="sidebar-footer">
        <SettingsButton />
      </div>
    </div>
  )
}

export default Sidebar
