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
        
        try {
          set({ conversationId: id }, false, 'selectConversation')
          const url = `${getApiBase()}/api/conversations/${id}`
          const resp = await fetch(url)
          
          if (!resp.ok) {
            throw new Error(`Failed to load conversation: ${resp.status} ${resp.statusText}`)
          }
          
          const data = await resp.json()
          
          // Validate response structure
          if (!data || !data.conversation || !Array.isArray(data.conversation.messages)) {
            throw new Error('Invalid conversation data received from server')
          }
          
          // Backend now sends UI-ready messages - minimal transformation needed
          const uiMessages: UIMessage[] = data.conversation.messages.map((msg: any) => {
            // Validate required message properties
            if (!msg.id || !msg.type || !msg.timestamp) {
              console.warn('Invalid message structure:', msg)
              return null
            }
            
            return {
              ...msg,
              timestamp: new Date(msg.timestamp), // Convert ISO string back to Date
              // Handle thinking message properties
              ...(msg.type === 'thinking' && {
                isStreaming: msg.is_streaming,
                isCollapsed: msg.is_collapsed
              })
            }
          }).filter(Boolean) // Remove any null messages
          
          onMessagesLoaded(uiMessages)
        } catch (error: any) {
          console.error('Error loading conversation:', error)
          // Reset state on error
          set({ conversationId: null }, false, 'selectConversation')
          onReset()
          // You might want to show an error message to the user here
        }
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

    }),
    {
      name: 'conversation-store'
    }
  )
)
