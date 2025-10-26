import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMCPServersQuery, useToggleMCPServerMutation } from '../../../shared/api/queries'
import './MCPServerDropdown.css'

const MCPServerDropdown: React.FC = () => {
  // Use React Query for MCP servers
  const { 
    data: servers = {}, 
    isLoading, 
    error 
  } = useMCPServersQuery()
  
  const toggleServerMutation = useToggleMCPServerMutation()

  const handleToggleServer = async (serverName: string, enabled: boolean) => {
    try {
      await toggleServerMutation.mutateAsync({ server_name: serverName, enabled })
    } catch (error) {
      console.error('Failed to toggle server:', error)
    }
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
    <div className="mcp-server-dropdown">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="mcp-dropdown-trigger"
            disabled={isLoading}
          >
            <span className="mcp-status-text">
              MCP ({runningCount}/{totalCount})
            </span>
            <svg 
              className="mcp-dropdown-arrow"
              width="12" 
              height="12" 
              viewBox="0 0 12 12" 
              fill="none"
            >
              <path 
                d="M3 4.5L6 7.5L9 4.5" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content className="mcp-dropdown-content" align="end">
            <div className="mcp-dropdown-header">
              <h4>MCP Servers</h4>
              {error && (
                <div className="mcp-error">
                  {error.message}
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
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}

export default MCPServerDropdown
