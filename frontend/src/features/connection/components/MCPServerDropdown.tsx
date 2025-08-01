import { useState, useEffect, useRef } from 'react'
import { useMCPServerStore } from '../stores/useMCPServerStore'
import './MCPServerDropdown.css'

const MCPServerDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const {
    servers,
    isLoading,
    error,
    fetchServerStates,
    toggleServer,
    clearError
  } = useMCPServerStore()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch server states on mount and periodically
  useEffect(() => {
    fetchServerStates()
    const interval = setInterval(fetchServerStates, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [fetchServerStates])

  const handleToggleServer = async (serverName: string, enabled: boolean) => {
    await toggleServer(serverName, enabled)
  }

  const getServerStatusColor = (server: { enabled: boolean; running: boolean }) => {
    if (!server.enabled) return '#6c757d' // Gray for disabled
    if (server.running) return '#28a745' // Green for running
    return '#dc3545' // Red for enabled but not running (error)
  }

  const getServerStatusText = (server: { enabled: boolean; running: boolean }) => {
    if (!server.enabled) return 'Disabled'
    if (server.running) return 'Running'
    return 'Error'
  }

  const serverEntries = Object.entries(servers)
  const runningCount = serverEntries.filter(([_, server]) => server.running).length
  const totalCount = serverEntries.length

  return (
    <div className="mcp-server-dropdown" ref={dropdownRef}>
      <button
        className="mcp-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
      >
        <span className="mcp-status-text">
          MCP ({runningCount}/{totalCount})
        </span>
        <span className={`mcp-dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="mcp-dropdown-content">
          <div className="mcp-dropdown-header">
            <h4>MCP Servers</h4>
            {error && (
              <div className="mcp-error">
                {error}
                <button onClick={clearError} className="mcp-error-close">×</button>
              </div>
            )}
          </div>

          <div className="mcp-server-list">
            {serverEntries.length === 0 ? (
              <div className="mcp-no-servers">No MCP servers configured</div>
            ) : (
              serverEntries.map(([serverName, server]) => (
                <div key={serverName} className="mcp-server-item">
                  <div className="mcp-server-info">
                    <div className="mcp-server-name">{serverName}</div>
                    <div 
                      className="mcp-server-status"
                      style={{ color: getServerStatusColor(server) }}
                    >
                      {getServerStatusText(server)}
                    </div>
                  </div>
                  <label className="mcp-switch">
                    <input
                      type="checkbox"
                      checked={server.enabled}
                      onChange={(e) => handleToggleServer(serverName, e.target.checked)}
                      disabled={isLoading}
                    />
                    <span className="mcp-slider"></span>
                  </label>
                </div>
              ))
            )}
          </div>

          {isLoading && (
            <div className="mcp-loading">
              <div className="mcp-spinner"></div>
              <span>Updating servers...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MCPServerDropdown
