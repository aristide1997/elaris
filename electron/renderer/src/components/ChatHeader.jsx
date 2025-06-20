import './ChatHeader.css'

function ChatHeader({ isConnected }) {
  return (
    <header className="header">
      <h1>🚀 MCP Chat Client</h1>
      <div className="connection-status">
        <span className={`status-dot ${isConnected ? 'connected' : ''}`}></span>
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </header>
  )
}

export default ChatHeader 