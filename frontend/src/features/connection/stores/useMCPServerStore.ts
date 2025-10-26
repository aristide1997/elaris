import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { getApiBase } from '../../../shared/utils/api'

interface MCPServerState {
  configured: boolean
  enabled: boolean
  running: boolean
}

interface MCPServerStoreState {
  servers: Record<string, MCPServerState>
  isLoading: boolean
  error: string | null
}

interface MCPServerStoreActions {
  fetchServerStates: () => Promise<void>
  toggleServer: (serverName: string, enabled: boolean) => Promise<void>
  clearError: () => void
}

type MCPServerStore = MCPServerStoreState & MCPServerStoreActions

const initialState: MCPServerStoreState = {
  servers: {},
  isLoading: false,
  error: null
}

export const useMCPServerStore = create<MCPServerStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      fetchServerStates: async () => {
        set({ isLoading: true, error: null }, false, 'fetchServerStates/start')
        
        try {
          const base = getApiBase()
          const response = await fetch(`${base}/api/mcp-servers/states`)
          const data = await response.json()
          
          if (data.status === 'success') {
            set({ 
              servers: data.servers, 
              isLoading: false 
            }, false, 'fetchServerStates/success')
          } else {
            set({ 
              error: data.message || 'Failed to fetch server states',
              isLoading: false 
            }, false, 'fetchServerStates/error')
          }
        } catch (error) {
          set({ 
            error: `Failed to fetch server states: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isLoading: false 
          }, false, 'fetchServerStates/error')
        }
      },

      toggleServer: async (serverName: string, enabled: boolean) => {
        set({ isLoading: true, error: null }, false, 'toggleServer/start')
        
        try {
          const base = getApiBase()
          const response = await fetch(`${base}/api/mcp-servers/toggle`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ server_name: serverName, enabled })
          })
          
          const data = await response.json()
          
          if (data.status === 'success') {
            // Update the local state
            const currentServers = get().servers
            set({ 
              servers: {
                ...currentServers,
                [serverName]: {
                  ...currentServers[serverName],
                  enabled,
                  running: enabled // Assume running state matches enabled for now
                }
              },
              isLoading: false 
            }, false, 'toggleServer/success')

            // Refetch states to get accurate running status
            setTimeout(() => {
              get().fetchServerStates()
            }, 500)
          } else {
            set({ 
              error: data.message || `Failed to ${enabled ? 'enable' : 'disable'} server`,
              isLoading: false 
            }, false, 'toggleServer/error')
          }
        } catch (error) {
          set({ 
            error: `Failed to toggle server: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isLoading: false 
          }, false, 'toggleServer/error')
        }
      },

      clearError: () => {
        set({ error: null }, false, 'clearError')
      }
    }),
    {
      name: 'mcp-server-store'
    }
  )
)
