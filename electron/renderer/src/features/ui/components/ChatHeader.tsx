import React, { type ReactElement } from 'react'
import { MCPServerDropdown } from '../../connection'
import ModelPicker from './ModelPicker'
import './ChatHeader.css'

interface ChatHeaderProps {
  isConnected: boolean
  onDebugClick: () => void
  onToggleSidebar: () => void
  isSidebarCollapsed?: boolean
  debugMode?: boolean
}

function ChatHeader({ isConnected, onDebugClick, onToggleSidebar, debugMode = true }: ChatHeaderProps): ReactElement {
  return (
    <header className="header">
      <div className="header-left">
        <button className="sidebar-toggle-header" onClick={onToggleSidebar} title="Toggle Sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <h1>🚀 MCP Chat Client</h1>
      </div>
      <div className="header-controls">
        {debugMode && (
          <button className="debug-button" onClick={onDebugClick} title="View Message Debug">
            🔍 Debug
          </button>
        )}
        <MCPServerDropdown />
        <ModelPicker />
        {debugMode && (
          <div className="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : ''}`}></span>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        )}
      </div>
    </header>
  )
}

export default ChatHeader
