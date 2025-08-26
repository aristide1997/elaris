import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiBase } from '../../utils/api'

interface MCPServerState {
  configured: boolean
  enabled: boolean
  running: boolean
}

interface MCPServersResponse {
  status: string
  servers: Record<string, MCPServerState>
  message?: string
}

interface ToggleServerRequest {
  server_name: string
  enabled: boolean
}

interface ToggleServerResponse {
  status: string
  message?: string
}

// Query Keys
export const mcpServerKeys = {
  all: ['mcp-servers'] as const,
  states: () => [...mcpServerKeys.all, 'states'] as const,
}

// Fetch MCP server states
const fetchMCPServerStates = async (): Promise<Record<string, MCPServerState>> => {
  const base = getApiBase()
  const response = await fetch(`${base}/api/mcp-servers/states`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch MCP server states: ${response.status} ${response.statusText}`)
  }
  
  const data: MCPServersResponse = await response.json()
  
  if (data.status !== 'success') {
    throw new Error(data.message || 'Failed to fetch server states')
  }
  
  return data.servers
}

// Toggle MCP server
const toggleMCPServer = async ({ server_name, enabled }: ToggleServerRequest): Promise<void> => {
  const base = getApiBase()
  const response = await fetch(`${base}/api/mcp-servers/toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ server_name, enabled })
  })
  
  if (!response.ok) {
    throw new Error(`Failed to toggle server: ${response.status} ${response.statusText}`)
  }
  
  const data: ToggleServerResponse = await response.json()
  
  if (data.status !== 'success') {
    throw new Error(data.message || `Failed to ${enabled ? 'enable' : 'disable'} server`)
  }
}

// Hooks
export const useMCPServersQuery = () => {
  return useQuery({
    queryKey: mcpServerKeys.states(),
    queryFn: fetchMCPServerStates,
    staleTime: 30 * 1000, // 30 seconds (servers change frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 1000, // Refetch every 5 seconds when active
    refetchIntervalInBackground: false,
  })
}

export const useToggleMCPServerMutation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: toggleMCPServer,
    onMutate: async ({ server_name, enabled }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: mcpServerKeys.states() })
      
      // Snapshot the previous value
      const previousServers = queryClient.getQueryData<Record<string, MCPServerState>>(mcpServerKeys.states())
      
      // Optimistically update to the new value
      queryClient.setQueryData<Record<string, MCPServerState>>(
        mcpServerKeys.states(),
        (old) => {
          if (!old) return old
          return {
            ...old,
            [server_name]: {
              ...old[server_name],
              enabled,
              running: enabled // Optimistically assume it will run if enabled
            }
          }
        }
      )
      
      // Return a context object with the snapshotted value
      return { previousServers }
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousServers) {
        queryClient.setQueryData(mcpServerKeys.states(), context.previousServers)
      }
    },
    onSettled: () => {
      // Always refetch after error or success to get accurate state
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: mcpServerKeys.states() })
      }, 500)
    },
  })
}
