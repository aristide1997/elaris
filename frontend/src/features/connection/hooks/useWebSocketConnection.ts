import { useEffect } from 'react'
import { useMCPWebSocket } from './useMCPWebSocket'
import { useMessageHandlers } from '../../../shared/hooks/useMessageHandlers'
import { useConnectionStore } from '../stores/useConnectionStore'
// removed automatic stub creation; defer until sending first message

export function useWebSocketConnection() {
  const { handleServerMessage, handleRawApprovalRequest, setConnection } = useMessageHandlers()
  const { isConnected, serverPort, sendMessage: wsSendMessage } = useConnectionStore()

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
    setConnection(wsConnected, wsServerPort, sendWebSocketMessage)
  }, [wsConnected, wsServerPort, sendWebSocketMessage, setConnection])
}
