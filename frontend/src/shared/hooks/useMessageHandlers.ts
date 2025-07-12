import { useConnectionStore } from '../../features/connection/stores/useConnectionStore'
import { useChatOrchestratorStore } from '../../features/chat/stores/useChatOrchestratorStore'

/**
 * Hook for WebSocket message handling - used by connection infrastructure
 */
export const useMessageHandlers = () => {
  const handleServerMessage = useChatOrchestratorStore(state => state.handleServerMessage)
  const handleRawApprovalRequest = useChatOrchestratorStore(state => state.handleRawApprovalRequest)
  const setConnection = useConnectionStore(state => state.setConnection)
  
  return {
    handleServerMessage,
    handleRawApprovalRequest,
    setConnection
  }
} 