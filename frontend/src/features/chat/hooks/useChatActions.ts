import { useConnectionStore } from '../../connection/stores/useConnectionStore'
import { useMessagesStore } from '../stores/useMessagesStore'
import { useConversationStore } from '../../conversations/stores/useConversationStore'
import { useChatOrchestratorStore } from '../stores/useChatOrchestratorStore'

/**
 * Primary hook for chat functionality - provides most commonly used chat state and actions
 * Combines data from multiple stores into a clean API for components
 */
export const useChatActions = () => {
  const isConnected = useConnectionStore(state => state.isConnected)
  const serverPort = useConnectionStore(state => state.serverPort)
  const messages = useMessagesStore(state => state.messages)
  const conversationId = useConversationStore(state => state.conversationId)
  
  const sendMessage = useChatOrchestratorStore(state => state.sendMessage)
  const editMessage = useChatOrchestratorStore(state => state.editMessage)
  const stopMessage = useChatOrchestratorStore(state => state.stopMessage)
  const selectConversation = useChatOrchestratorStore(state => state.selectConversation)
  const startNewChat = useChatOrchestratorStore(state => state.startNewChat)
  const resetConversation = useChatOrchestratorStore(state => state.resetConversation)

  const isStreaming = useMessagesStore(state => Boolean(state.currentAssistantId))

  return {
    // State
    isConnected,
    serverPort,
    messages,
    conversationId,
    isStreaming,
    // Actions
    sendMessage,
    editMessage,
    stopMessage,
    selectConversation,
    startNewChat,
    resetConversation
  }
}
