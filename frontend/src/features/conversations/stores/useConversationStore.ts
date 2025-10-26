import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { UIMessage } from '../../chat/types'
import type { ConversationStore, ConversationState } from '../types'
import { getApiBase } from '../../../shared/utils/api'

const initialState: ConversationState = {
  conversationId: null
}

export const useConversationStore = create<ConversationStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setConversationId: (id: string | null) => {
        set({ conversationId: id }, false, 'setConversationId')
      },

      selectConversation: async (id: string, serverPort: number | null, onMessagesLoaded: (messages: UIMessage[]) => void, onReset: () => void) => {
        if (!id) {
          set({ conversationId: null }, false, 'selectConversation')
          onReset()
          return
        }
        set({ conversationId: id }, false, 'selectConversation')
        const url = `${getApiBase()}/api/conversations/${id}`
        const resp = await fetch(url)
        const data = await resp.json()
        const conv = data.conversation
        const uiMsgs: UIMessage[] = get().mapConversationToUI(conv)
        onMessagesLoaded(uiMsgs)
      },

      startNewChat: async (serverPort: number | null, onError: (message: string) => void, onReset: () => void) => {
        try {
          console.log('Starting new chat, serverPort:', serverPort)
          const url = `${getApiBase()}/api/conversations`
          console.log('Making request to:', url)
          const resp = await fetch(url, { method: 'POST' })
          if (!resp.ok) throw new Error(`Status ${resp.status}`)
          const data = await resp.json()
          const newConversationId = data.conversation_id
          console.log('New conversation created:', newConversationId)
          set({ conversationId: newConversationId }, false, 'startNewChat')
          // Reset chat messages while preserving the new conversation ID
          onReset()
        } catch (err: any) {
          console.error('Failed to create new conversation:', err)
          onError(`Failed to create new conversation: ${err.message}`)
        }
      },

      mapConversationToUI: (conv: { messages: any[] }) => {
        const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`
        
        function mapPartToUIMessage(part: any): UIMessage | null {
          const base = {
            id: generateId(),
            timestamp: new Date(part.timestamp),
            content: typeof part.content === 'string' ? part.content : String(part.content)
          }
          switch (part.part_kind) {
            case 'system-prompt':
              return null // Skip system prompts - don't show in chat history
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
            case 'thinking':
              return {
                ...base,
                type: 'thinking' as const,
                isStreaming: false,  // Historical thinking is not streaming
                isCollapsed: true    // Default to collapsed for historical content
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
                    session.tools = session.tools.map((tool: any) =>
                      tool.id === part.tool_call_id
                        ? { ...tool, result: typeof part.content === 'string' ? part.content : JSON.stringify(part.content) }
                        : tool
                    )
                  }
                  break
                }
                default:
                  mapPartToUIMessage(part) && uiMsgs.push(mapPartToUIMessage(part)!)
              }
            })
          } else {
            mapPartToUIMessage(msg) && uiMsgs.push(mapPartToUIMessage(msg)!)
          }
        })
        return uiMsgs
      }
    }),
    {
      name: 'conversation-store'
    }
  )
)
