import { useChatOrchestratorStore } from '../../features/chat/stores/useChatOrchestratorStore'

/**
 * Hook for WebSocket message handling - used by connection infrastructure
 */
export const useMessageHandlers = () => {
  const handleServerMessage = useChatOrchestratorStore(state => state.handleServerMessage)
  const handleRawApprovalRequest = useChatOrchestratorStore(state => state.handleRawApprovalRequest)
  
  return {
    handleServerMessage,
    handleRawApprovalRequest
  }
}
