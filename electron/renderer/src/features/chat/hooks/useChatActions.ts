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
  const selectConversation = useChatOrchestratorStore(state => state.selectConversation)
  const startNewChat = useChatOrchestratorStore(state => state.startNewChat)
  
  return {
    // State
    isConnected,
    serverPort,
    messages,
    conversationId,
    // Actions
    sendMessage,
    selectConversation,
    startNewChat
  }
} 