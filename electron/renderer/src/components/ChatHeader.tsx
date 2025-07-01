import React, { type ReactElement } from 'react'
import './ChatHeader.css'

interface ChatHeaderProps {
  isConnected: boolean
  onDebugClick: () => void
  onHistoryClick: () => void
}

function ChatHeader({ isConnected, onDebugClick, onHistoryClick }: ChatHeaderProps): ReactElement {
  return (
    <header className="header">
      <h1>🚀 MCP Chat Client</h1>
      <div className="header-controls">
        <button className="history-button" onClick={onHistoryClick} title="View Conversations">
          📜 History
        </button>
        <button className="debug-button" onClick={onDebugClick} title="View Message Debug">
          🔍 Debug
        </button>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? 'connected' : ''}`}></span>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  )
}

export default ChatHeader
