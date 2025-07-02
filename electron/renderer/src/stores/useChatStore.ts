import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { UIMessage, MCPClientMessage, MCPServerMessage, MCPApprovalRequest, ToolInstance } from '../types'
import { MessageService } from '../services/MessageService'
import { useApprovalStore } from './useApprovalStore'

interface ChatState {
  messages: UIMessage[]
  conversationId: string | null
  isConnected: boolean
  currentAssistantId: string | null
  currentToolSessionId: string | null
  serverPort: number | null
  sendWebSocketMessage: ((message: MCPClientMessage) => void) | null
}

interface ChatActions {
  setMessages: (messages: UIMessage[]) => void
  addMessage: (message: UIMessage) => void
  updateMessage: (id: string, updates: Partial<UIMessage>) => void
  setConversationId: (id: string | null) => void
  setConnection: (connected: boolean, serverPort?: number | null, sendFn?: ((message: MCPClientMessage) => void) | null) => void
  setCurrentAssistantId: (id: string | null) => void
  setCurrentToolSessionId: (id: string | null) => void
  initMessages: (messages: UIMessage[]) => void
  resetToWelcome: () => void
  sendMessage: (content: string) => void
  handleServerMessage: (message: MCPServerMessage) => void
  handleRawApprovalRequest: (msg: MCPApprovalRequest) => void
  selectConversation: (id: string) => Promise<void>
  startNewChat: () => Promise<void>
  // Message handling helpers
  handleSystemReady: (message: string) => void
  handleAssistantStart: () => void
  handleTextDelta: (content: string) => void
  handleAssistantComplete: () => void
  handleToolSessionStart: () => void
  handleToolStart: (toolId: string, toolName: string) => void
  handleToolComplete: (toolId: string, content: string) => void
  handleToolBlocked: (toolId: string) => void
  handleToolError: (toolId: string, toolName: string, error: string) => void
  handleApprovalRequest: (toolId: string) => void
  handleToolSessionComplete: () => void
  handleError: (message: string) => void
  mapConversationToUI: (conv: { messages: any[] }) => UIMessage[]
}

type ChatStore = ChatState & ChatActions

const initialMessages: UIMessage[] = [
  {
    id: 'welcome',
    type: 'system',
    content: 'Welcome to MCP Chat Client!\nThis interface provides access to AI with MCP (Model Context Protocol) tools.\nYou\'ll be asked to approve any tool executions for security.',
    timestamp: new Date()
  }
]

const initialState: ChatState = {
  messages: initialMessages,
  conversationId: null,
  isConnected: false,
  currentAssistantId: null,
  currentToolSessionId: null,
  serverPort: null,
  sendWebSocketMessage: null
}

export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      setMessages: (messages: UIMessage[]) => {
        set({ messages }, false, 'setMessages')
      },

      addMessage: (message: UIMessage) => {
        set((state) => ({ 
          ...state,
          messages: [...state.messages, message] as UIMessage[]
        }), false, 'addMessage')
      },

      updateMessage: (id: string, updates: Partial<UIMessage>) => {
        set((state) => ({
          ...state,
          messages: state.messages.map(msg => 
            msg.id === id ? { ...msg, ...updates } as UIMessage : msg
          ) as UIMessage[]
        }), false, 'updateMessage')
      },

      setConversationId: (id: string | null) => {
        set({ conversationId: id }, false, 'setConversationId')
      },

      setConnection: (connected: boolean, serverPort?: number | null, sendFn?: ((message: MCPClientMessage) => void) | null) => {
        set({ 
          isConnected: connected,
          serverPort: serverPort ?? null,
          sendWebSocketMessage: sendFn ?? null
        }, false, 'setConnection')
      },

      setCurrentAssistantId: (id: string | null) => {
        set({ currentAssistantId: id }, false, 'setCurrentAssistantId')
      },

      setCurrentToolSessionId: (id: string | null) => {
        set({ currentToolSessionId: id }, false, 'setCurrentToolSessionId')
      },

      initMessages: (messages: UIMessage[]) => {
        set({
          messages,
          currentAssistantId: null,
          currentToolSessionId: null
        }, false, 'initMessages')
      },

      resetToWelcome: () => {
        set({
          messages: initialMessages,
          conversationId: null,
          currentAssistantId: null,
          currentToolSessionId: null
        }, false, 'resetToWelcome')
      },

      sendMessage: (content: string) => {
        const state = get()
        // Add user message to store
        const userMessage: UIMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
          type: 'user',
          content,
          timestamp: new Date()
        }
        
        set((prevState) => ({
          ...prevState,
          messages: [...prevState.messages, userMessage]
        }), false, 'sendMessage')

        // Send via WebSocket if available
        if (state.sendWebSocketMessage) {
          state.sendWebSocketMessage({
            type: 'chat_message',
            conversation_id: state.conversationId,
            content
          } as MCPClientMessage)
        }
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
          case 'tool_session_complete':
            get().handleToolSessionComplete()
            break
          case 'error':
            get().handleError(message.message)
            break
        }
      },

      selectConversation: async (id: string) => {
        const state = get()
        if (!id) {
          set({ conversationId: null }, false, 'selectConversation')
          get().resetToWelcome()
          return
        }
        set({ conversationId: id }, false, 'selectConversation')
        const url = state.serverPort
          ? `http://localhost:${state.serverPort}/api/conversations/${id}`
          : `/api/conversations/${id}`
        const resp = await fetch(url)
        const data = await resp.json()
        const conv = data.conversation
        const uiMsgs: UIMessage[] = get().mapConversationToUI(conv)
        get().initMessages(uiMsgs)
      },

      startNewChat: async () => {
        const state = get()
        try {
          console.log('Starting new chat, serverPort:', state.serverPort)
          const url = state.serverPort
            ? `http://localhost:${state.serverPort}/api/conversations`
            : `/api/conversations`
          console.log('Making request to:', url)
          const resp = await fetch(url, { method: 'POST' })
          if (!resp.ok) throw new Error(`Status ${resp.status}`)
          const data = await resp.json()
          const newConversationId = data.conversation_id
          console.log('New conversation created:', newConversationId)
          set({ conversationId: newConversationId }, false, 'startNewChat')
          // Reset chat messages while preserving the new conversation ID
          get().initMessages(initialMessages)
        } catch (err: any) {
          console.error('Failed to create new conversation:', err)
          get().handleError(`Failed to create new conversation: ${err.message}`)
        }
      },

      // Message handling helpers
      handleSystemReady: (message: string) => {
        const msg = MessageService.systemMessage(message)
        get().addMessage(msg)
      },

      handleAssistantStart: () => {
        const state = get()
        if (!state.currentAssistantId) {
          const newMsg = MessageService.assistantStart()
          get().addMessage(newMsg)
          set({ currentAssistantId: newMsg.id }, false, 'handleAssistantStart')
        }
      },

      handleTextDelta: (content: string) => {
        const state = get()
        let assistantId = state.currentAssistantId
        let messages = state.messages
        
        // If no assistant message exists, create one
        if (!assistantId) {
          const fallback = MessageService.assistantStart()
          assistantId = fallback.id
          messages = [...messages, fallback]
        }
        
        // Update the assistant message with the new content
        const updatedMessages = messages.map(m => {
          if (m.id === assistantId && m.type === 'assistant') {
            const updatedMessage = MessageService.appendAssistantDelta(m, content)
            return updatedMessage
          }
          return m
        })
        
        // Update state atomically
        set({
          messages: updatedMessages,
          currentAssistantId: assistantId
        }, false, 'handleTextDelta')
      },

      handleAssistantComplete: () => {
        set({ currentAssistantId: null }, false, 'handleAssistantComplete')
      },

      handleToolSessionStart: () => {
        const session = MessageService.toolSessionMessage()
        get().addMessage(session)
        set({ currentToolSessionId: session.id }, false, 'handleToolSessionStart')
      },

      handleToolStart: (toolId: string, toolName: string) => {
        const state = get()
        if (!state.currentToolSessionId) return
        
        const sessionMessage = state.messages.find(m => m.id === state.currentToolSessionId)
        if (sessionMessage && sessionMessage.type === 'tool_session') {
          const newTool = MessageService.createToolInstance(toolId, toolName)
          const updatedTools = [...(sessionMessage.tools || []), newTool]
          get().updateMessage(state.currentToolSessionId, { tools: updatedTools })
        }
      },

      handleToolComplete: (toolId: string, content: string) => {
        const state = get()
        if (!state.currentToolSessionId) return
        
        const sessionMessage = state.messages.find(m => m.id === state.currentToolSessionId)
        if (sessionMessage && sessionMessage.type === 'tool_session') {
          const updatedTools = (sessionMessage.tools || []).map((t: ToolInstance) =>
            t.id === toolId
              ? { ...t, status: 'completed' as const, result: content }
              : t
          )
          get().updateMessage(state.currentToolSessionId, { 
            status: 'completed',
            tools: updatedTools 
          })
        }
      },

      handleToolBlocked: (toolId: string) => {
        const state = get()
        if (!state.currentToolSessionId) return
        
        const sessionMessage = state.messages.find(m => m.id === state.currentToolSessionId)
        if (sessionMessage && sessionMessage.type === 'tool_session') {
          const updatedTools = (sessionMessage.tools || []).map((t: ToolInstance) =>
            t.id === toolId
              ? { ...t, status: 'blocked' as const }
              : t
          )
          get().updateMessage(state.currentToolSessionId, { 
            status: 'blocked',
            tools: updatedTools 
          })
        }
      },

      handleToolError: (toolId: string, toolName: string, error: string) => {
        const errorMsg = MessageService.errorMessage(`Tool ${toolName} failed: ${error}`)
        get().addMessage(errorMsg)
        get().handleToolBlocked(toolId)
      },

      handleApprovalRequest: (toolId: string) => {
        const state = get()
        const toolSession = state.messages.find(m => 
          m.type === 'tool_session' && 
          m.tools?.some(t => t.id === toolId)
        )
        
        if (toolSession && toolSession.type === 'tool_session') {
          const updatedTools = (toolSession.tools || []).map((t: ToolInstance) =>
            t.id === toolId
              ? { ...t, status: 'pending_approval' as const }
              : t
          )
          get().updateMessage(toolSession.id, { tools: updatedTools })
        }
      },

      handleToolSessionComplete: () => {
        const state = get()
        if (!state.currentToolSessionId) return
        
        const sessionMessage = state.messages.find(m => m.id === state.currentToolSessionId)
        if (sessionMessage && sessionMessage.type === 'tool_session') {
          const blocked = (sessionMessage.tools || []).some((t) => t.status === 'blocked')
          get().updateMessage(state.currentToolSessionId, { 
            status: blocked ? 'blocked' : 'completed' 
          })
        }
        
        set({ currentToolSessionId: null }, false, 'handleToolSessionComplete')
      },

      handleError: (message: string) => {
        const msg = MessageService.errorMessage(message)
        get().addMessage(msg)
      },

      mapConversationToUI: (conv: { messages: any[] }) => {
        const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`
        
        function mapPartToUIMessage(part: any): UIMessage {
          const base = {
            id: generateId(),
            timestamp: new Date(part.timestamp),
            content: typeof part.content === 'string' ? part.content : String(part.content)
          }
          switch (part.part_kind) {
            case 'system-prompt':
              return { ...base, type: 'system', subtype: 'info' }
            case 'user-prompt':
              return { ...base, type: 'user' }
            case 'text':
              return { ...base, type: 'assistant' }
            case 'tool-call':
              return {
                ...base,
                type: 'system',
                subtype: 'info',
                content: `Tool call: ${part.tool_name}(${typeof part.args === 'object' ? JSON.stringify(part.args) : part.args})`
              }
            case 'tool-return':
              return {
                ...base,
                type: 'system',
                subtype: 'info',
                content: `Tool result: ${part.tool_name} => ${typeof part.content === 'string' ? part.content : JSON.stringify(part.content)}`
              }
            case 'retry-prompt':
              return {
                ...base,
                type: 'system',
                subtype: 'error',
                content: `Retry prompt: ${typeof part.content === 'string' ? part.content : JSON.stringify(part.content)}`
              }
            default:
              return { ...base, type: 'system', subtype: 'error' }
          }
        }

        const uiMsgs: UIMessage[] = []
        const sessionsMap: Record<string, any> = {}
        conv.messages.forEach((msg: any) => {
          if (Array.isArray(msg.parts)) {
            msg.parts.forEach((part: any) => {
              switch (part.part_kind) {
                case 'tool-call': {
                  const session: UIMessage = {
                    id: generateId(),
                    type: 'tool_session' as const,
                    timestamp: new Date(part.timestamp),
                    status: 'completed' as const,
                    tools: [{ id: part.tool_call_id, name: part.tool_name, status: 'completed' as const, timestamp: new Date(part.timestamp) }],
                  }
                  sessionsMap[part.tool_call_id] = session
                  uiMsgs.push(session)
                  break
                }
                case 'tool-return': {
                  const session = sessionsMap[part.tool_call_id]
                  if (session) {
                    session.tools = session.tools.map((tool: ToolInstance) =>
                      tool.id === part.tool_call_id
                        ? { ...tool, result: typeof part.content === 'string' ? part.content : JSON.stringify(part.content) }
                        : tool
                    )
                  }
                  break
                }
                default:
                  uiMsgs.push(mapPartToUIMessage(part))
              }
            })
          } else {
            uiMsgs.push(mapPartToUIMessage(msg))
          }
        })
        return uiMsgs
      }
    }),
    {
      name: 'chat-store'
    }
  )
)
