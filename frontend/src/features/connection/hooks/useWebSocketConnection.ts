import { useEffect } from 'react'
import { useMCPWebSocket } from './useMCPWebSocket'
import { useMessageHandlers } from '../../../shared/hooks/useMessageHandlers'
import { useConnectionStore } from '../stores/useConnectionStore'
import { invalidateAllQueries } from '../../../shared/api/queryClient'

export function useWebSocketConnection() {
  const { handleServerMessage, handleRawApprovalRequest } = useMessageHandlers()
  const { markConnected, markDisconnected, setServerPort, status } = useConnectionStore()

  const {
    isConnected: wsConnected,
    sendMessage: sendWebSocketMessage,
    serverPort: wsServerPort
  } = useMCPWebSocket({
    onMessage: handleServerMessage,
    onApprovalRequest: handleRawApprovalRequest
  })

  // Update connection state when WebSocket changes
  useEffect(() => {
    const wasReconnecting = status === 'reconnecting'
    
    if (wsConnected) {
      markConnected(wsServerPort, sendWebSocketMessage)
      
      // If we were reconnecting, invalidate all queries to refresh data
      if (wasReconnecting) {
        console.log('Reconnected! Refreshing all cached data...')
        invalidateAllQueries()
      }
    } else {
      markDisconnected()
    }
  }, [wsConnected, wsServerPort, sendWebSocketMessage, markConnected, markDisconnected, status])

  // Update server port when it changes
  useEffect(() => {
    setServerPort(wsServerPort)
  }, [wsServerPort, setServerPort])
}
