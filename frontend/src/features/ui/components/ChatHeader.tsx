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

function ChatHeader({ isConnected, onDebugClick, onToggleSidebar, isSidebarCollapsed, debugMode = true }: ChatHeaderProps): ReactElement {
  return (
    <header className="header">
      <div className="header-left">
        <button 
          className={`sidebar-toggle-header ${!isSidebarCollapsed ? 'open' : ''}`} 
          onClick={onToggleSidebar} 
          title={isSidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
          aria-label={isSidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
        >
          <div className="toggle-icon">
            <span className="toggle-bar"></span>
            <span className="toggle-bar"></span>
            <span className="toggle-bar"></span>
          </div>
        </button>
        <h1>MCP Chat Client</h1>
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
