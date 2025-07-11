import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { MCPServerMessage, MCPClientMessage } from '../types'
import type { MCPApprovalRequest } from '../../approval/types'
import { MessageService } from '../services/MessageService'
import { useApprovalStore } from '../../approval/stores/useApprovalStore'
import { useConnectionStore } from '../../connection/stores/useConnectionStore'
import { useMessagesStore } from './useMessagesStore'
import { useConversationStore } from '../../conversations/stores/useConversationStore'

interface ChatOrchestratorActions {
  // Idempotent stub creation flags
  isCreatingConversation: boolean
  pendingMessages: string[]
  sendMessage: (content: string) => void
  handleServerMessage: (message: MCPServerMessage) => void
  handleRawApprovalRequest: (msg: MCPApprovalRequest) => void
  selectConversation: (id: string) => Promise<void>
  startNewChat: () => Promise<void>
  stopMessage: () => void
  // Reset to a fresh draft without persisting or loading
  resetConversation: () => void
  // Message handling helpers
  handleSystemReady: (message: string) => void
  handleAssistantStart: () => void
  handleTextDelta: (content: string) => void
  handleAssistantComplete: () => void
  handleThinkingStart: () => void
  handleThinkingDelta: (content: string) => void
  handleThinkingComplete: () => void
  handleToolSessionStart: () => void
  handleToolStart: (toolId: string, toolName: string) => void
  handleToolComplete: (toolId: string, content: string) => void
  handleToolBlocked: (toolId: string) => void
  handleToolError: (toolId: string, toolName: string, error: string) => void
  handleApprovalRequest: (toolId: string) => void
  handleToolSessionComplete: () => void
  handleError: (message: string) => void
}

type ChatOrchestratorStore = ChatOrchestratorActions

export const useChatOrchestratorStore = create<ChatOrchestratorStore>()(
  devtools(
    (set, get) => ({
      // Idempotent stub creation state
      isCreatingConversation: false,
      pendingMessages: [] as string[],
      sendMessage: (content: string) => {
        const convStore = useConversationStore.getState()
        const connStore = useConnectionStore.getState()
        const msgStore = useMessagesStore.getState()
        const handleError = get().handleError
        const { serverPort, sendMessage: wsSend } = connStore
        const { conversationId } = convStore
        const { addMessage } = msgStore

        // Optimistically add user message
        const userMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
          type: 'user' as const,
          content,
          timestamp: new Date()
        }
        addMessage(userMessage)

        // If conversation already exists, send immediately
        if (conversationId) {
          wsSend({ type: 'chat_message', content, conversation_id: conversationId } as MCPClientMessage)
          return
        }

        // If stub creation in progress, queue this message
        if (get().isCreatingConversation) {
          set(state => ({ pendingMessages: [...state.pendingMessages, content] }))
          return
        }

        // Start stub creation and queue first message
        set({ isCreatingConversation: true, pendingMessages: [content] })
        convStore.startNewChat(serverPort, handleError, () => {})
          .then(() => {
            const newCid = useConversationStore.getState().conversationId!
            // Flush queued messages
            get().pendingMessages.forEach(msg => {
              wsSend({ type: 'chat_message', content: msg, conversation_id: newCid } as MCPClientMessage)
            })
          })
          .catch((err: any) => {
            handleError(`Failed to start conversation: ${err.message}`)
          })
          .finally(() => {
            set({ isCreatingConversation: false, pendingMessages: [] })
          })
      },

      handleRawApprovalRequest: (msg: MCPApprovalRequest) => {
        const { addToQueue, addPendingToolId, processPendingTool } = useApprovalStore.getState()
        const assignedToolId = processPendingTool()
        addToQueue({ ...msg, tool_id: assignedToolId || '' })
        get().handleApprovalRequest(assignedToolId || '')
      },

      handleServerMessage: (message: MCPServerMessage) => {
        const { addPendingToolId } = useApprovalStore.getState()
        
        if (message.type === 'tool_start') {
          addPendingToolId(message.tool_id)
        }
        
        // Handle different message types
        switch (message.type) {
          case 'system_ready':
            get().handleSystemReady(message.message)
            break
          case 'assistant_start':
            get().handleAssistantStart()
            break
          case 'text_delta':
            get().handleTextDelta(message.content)
            break
          case 'assistant_complete':
            get().handleAssistantComplete()
            break
          case 'thinking_start':
            get().handleThinkingStart()
            break
          case 'thinking_delta':
            get().handleThinkingDelta(message.content)
            break
          case 'thinking_complete':
            get().handleThinkingComplete()
            break
          case 'tool_session_start':
            get().handleToolSessionStart()
            break
          case 'tool_start':
            get().handleToolStart(message.tool_id, message.tool_name)
            break
          case 'tool_complete':
            get().handleToolComplete(message.tool_id, message.content)
            break
          case 'tool_blocked':
            get().handleToolBlocked(message.tool_id)
            break
          case 'tool_error':
            get().handleToolError(message.tool_id, message.tool_name, message.error)
            break
          case 'approval_request':
            get().handleRawApprovalRequest(message)
            break
          case 'tool_session_complete':
            get().handleToolSessionComplete()
            break
          case 'error':
            get().handleError(message.message)
            break
        }
      },

      selectConversation: async (id: string) => {
        const { serverPort } = useConnectionStore.getState()
        const { selectConversation } = useConversationStore.getState()
        const { initMessages, resetToWelcome } = useMessagesStore.getState()
        
        await selectConversation(id, serverPort, initMessages, resetToWelcome)
      },

      startNewChat: async () => {
        const { serverPort } = useConnectionStore.getState()
        const { startNewChat } = useConversationStore.getState()
        const { resetToWelcome } = useMessagesStore.getState()
        
        await startNewChat(serverPort, get().handleError, resetToWelcome)
      },

      stopMessage: () => {
        const conversationId = useConversationStore.getState().conversationId
        const sendMessage = useConnectionStore.getState().sendMessage
        if (conversationId) {
          sendMessage({ type: 'stop_stream', conversation_id: conversationId })
        }
        get().handleAssistantComplete()
      },
      // Reset to a fresh draft without persisting or loading
      resetConversation: () => {
        useConversationStore.getState().setConversationId(null)
        useMessagesStore.getState().resetToWelcome()
      },
      // Message handling helpers
      handleSystemReady: (message: string) => {
        const { addMessage } = useMessagesStore.getState()
        const msg = MessageService.systemMessage(message)
        addMessage(msg)
      },

      handleAssistantStart: () => {
        const { currentAssistantId, addMessage, setCurrentAssistantId } = useMessagesStore.getState()
        if (!currentAssistantId) {
          const newMsg = MessageService.assistantStart()
          addMessage(newMsg)
          setCurrentAssistantId(newMsg.id)
        }
      },

      handleTextDelta: (content: string) => {
        const { currentAssistantId, messages, setCurrentAssistantId } = useMessagesStore.getState()
        const { setMessages } = useMessagesStore.getState()
        
        let assistantId = currentAssistantId
        let currentMessages = messages
        
        // If no assistant message exists, create one
        if (!assistantId) {
          const fallback = MessageService.assistantStart()
          assistantId = fallback.id
          currentMessages = [...currentMessages, fallback]
        }
        
        // Update the assistant message with the new content
        const updatedMessages = currentMessages.map(m => {
          if (m.id === assistantId && m.type === 'assistant') {
            const updatedMessage = MessageService.appendAssistantDelta(m, content)
            return updatedMessage
          }
          return m
        })
        
        // Update state atomically
        setMessages(updatedMessages)
        setCurrentAssistantId(assistantId)
      },

      handleAssistantComplete: () => {
        const { setCurrentAssistantId } = useMessagesStore.getState()
        setCurrentAssistantId(null)
      },

      handleThinkingStart: () => {
        const { addMessage, setCurrentThinkingId } = useMessagesStore.getState()
        
        // Create a new thinking message
        const thinkingMessage = MessageService.thinkingStart()
        addMessage(thinkingMessage)
        setCurrentThinkingId(thinkingMessage.id)
      },

      handleThinkingDelta: (content: string) => {
        const { currentThinkingId, messages, updateMessage } = useMessagesStore.getState()
        
        if (!currentThinkingId) return
        
        const thinkingMessage = messages.find(m => m.id === currentThinkingId && m.type === 'thinking')
        if (thinkingMessage && thinkingMessage.type === 'thinking') {
          updateMessage(currentThinkingId, {
            content: thinkingMessage.content + content
          })
        }
      },

      handleThinkingComplete: () => {
        const { currentThinkingId, updateMessage, setCurrentThinkingId } = useMessagesStore.getState()
        
        if (!currentThinkingId) return
        
        updateMessage(currentThinkingId, {
          isStreaming: false,
          isCollapsed: true
        })
        
        setCurrentThinkingId(null)
      },

      handleToolSessionStart: () => {
        const { addMessage, setCurrentToolSessionId } = useMessagesStore.getState()
        const session = MessageService.toolSessionMessage()
        addMessage(session)
        setCurrentToolSessionId(session.id)
      },

      handleToolStart: (toolId: string, toolName: string) => {
        const { currentToolSessionId, messages, updateMessage } = useMessagesStore.getState()
        
        if (!currentToolSessionId) return
        
        const sessionMessage = messages.find(m => m.id === currentToolSessionId)
        if (sessionMessage && sessionMessage.type === 'tool_session') {
          const newTool = MessageService.createToolInstance(toolId, toolName)
          const updatedTools = [...(sessionMessage.tools || []), newTool]
          updateMessage(currentToolSessionId, { tools: updatedTools })
        }
      },

      handleToolComplete: (toolId: string, content: string) => {
        const { currentToolSessionId, messages, updateMessage } = useMessagesStore.getState()
        if (!currentToolSessionId) return
        
        const sessionMessage = messages.find(m => m.id === currentToolSessionId)
        if (sessionMessage && sessionMessage.type === 'tool_session') {
          const updatedTools = (sessionMessage.tools || []).map((t: any) =>
            t.id === toolId
              ? { ...t, status: 'completed' as const, result: content }
              : t
          )
          updateMessage(currentToolSessionId, { 
            status: 'completed',
            tools: updatedTools 
          })
        }
      },

      handleToolBlocked: (toolId: string) => {
        const { currentToolSessionId, messages, updateMessage } = useMessagesStore.getState()
        if (!currentToolSessionId) return
        
        const sessionMessage = messages.find(m => m.id === currentToolSessionId)
        if (sessionMessage && sessionMessage.type === 'tool_session') {
          const updatedTools = (sessionMessage.tools || []).map((t: any) =>
            t.id === toolId
              ? { ...t, status: 'blocked' as const }
              : t
          )
          updateMessage(currentToolSessionId, { 
            status: 'blocked',
            tools: updatedTools 
          })
        }
      },

      handleToolError: (toolId: string, toolName: string, error: string) => {
        const { addMessage } = useMessagesStore.getState()
        const errorMsg = MessageService.errorMessage(`Tool ${toolName} failed: ${error}`)
        addMessage(errorMsg)
        get().handleToolBlocked(toolId)
      },

      handleApprovalRequest: (toolId: string) => {
        const { messages, updateMessage } = useMessagesStore.getState()
        const toolSession = messages.find(m => 
          m.type === 'tool_session' && 
          m.tools?.some(t => t.id === toolId)
        )
        
        if (toolSession && toolSession.type === 'tool_session') {
          const updatedTools = (toolSession.tools || []).map((t: any) =>
            t.id === toolId
              ? { ...t, status: 'pending_approval' as const }
              : t
          )
          updateMessage(toolSession.id, { tools: updatedTools })
        }
      },

      handleToolSessionComplete: () => {
        const { currentToolSessionId, messages, updateMessage, setCurrentToolSessionId } = useMessagesStore.getState()
        if (!currentToolSessionId) return
        
        const sessionMessage = messages.find(m => m.id === currentToolSessionId)
        if (sessionMessage && sessionMessage.type === 'tool_session') {
          const blocked = (sessionMessage.tools || []).some((t: any) => t.status === 'blocked')
          updateMessage(currentToolSessionId, { 
            status: blocked ? 'blocked' : 'completed' 
          })
        }
        
        setCurrentToolSessionId(null)
      },

      handleError: (message: string) => {
        const { addMessage } = useMessagesStore.getState()
        const msg = MessageService.errorMessage(message)
        addMessage(msg)
      }
    }),
    {
      name: 'chat-orchestrator-store'
    }
  )
)
