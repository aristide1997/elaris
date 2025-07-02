import { useEffect, useRef } from 'react'
import { useMCPWebSocket } from './useMCPWebSocket'
import { useChatStore } from '../stores/useChatStore'

export function useWebSocketConnection() {
  const {
    handleServerMessage,
    handleRawApprovalRequest,
    setConnection,
    startNewChat,
    isConnected,
    serverPort,
    conversationId
  } = useChatStore()

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

  // Initialize stub only once, after WebSocket connects
  const didInitRef = useRef<boolean>(false)
  useEffect(() => {
    console.log('Effect triggered:', { isConnected, serverPort, conversationId, didInit: didInitRef.current })
    if (isConnected && serverPort && !conversationId && !didInitRef.current) {
      didInitRef.current = true
      console.log('Starting new chat...')
      void startNewChat()
    }
  }, [isConnected, serverPort, conversationId, startNewChat])
}
