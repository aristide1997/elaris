import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { UIMessage, MessagesStore, MessagesState } from '../types'
import { MessageService } from '../services/MessageService'

const initialState: MessagesState = {
  messages: [],
  currentAssistantId: null,
  currentThinkingId: null,
  currentToolSessionId: null
}

export const useMessagesStore = create<MessagesStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
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

      setMessages: (messages: UIMessage[]) => {
        set({ messages }, false, 'setMessages')
      },

      setCurrentAssistantId: (id: string | null) => {
        set({ currentAssistantId: id }, false, 'setCurrentAssistantId')
      },

      setCurrentThinkingId: (id: string | null) => {
        set({ currentThinkingId: id }, false, 'setCurrentThinkingId')
      },

      setCurrentToolSessionId: (id: string | null) => {
        set({ currentToolSessionId: id }, false, 'setCurrentToolSessionId')
      },

      initMessages: (messages: UIMessage[]) => {
        set({
          messages,
          currentAssistantId: null,
          currentThinkingId: null,
          currentToolSessionId: null
        }, false, 'initMessages')
      },

      resetToWelcome: () => {
        set({
          messages: [],
          currentAssistantId: null,
          currentThinkingId: null,
          currentToolSessionId: null
        }, false, 'resetToWelcome')
      },

      getUserMessageIndex: (messageId: string) => {
        const state = get()
        let userCount = 0
        
        for (const message of state.messages) {
          if (message.type === 'user') {
            if (message.id === messageId) {
              return userCount
            }
            userCount++
          }
        }
        
        return -1 // Message not found
      },

      truncateFromUserMessage: (messageId: string) => {
        set((state) => {
          let truncateIndex = -1
          
          // Find the position of the message to edit
          for (let i = 0; i < state.messages.length; i++) {
            if (state.messages[i].id === messageId) {
              truncateIndex = i
              break
            }
          }
          
          if (truncateIndex === -1) {
            return state // Message not found, no change
          }
          
          // Truncate messages from this point forward
          const truncatedMessages = state.messages.slice(0, truncateIndex + 1)
          
          return {
            ...state,
            messages: truncatedMessages,
            currentAssistantId: null,
            currentThinkingId: null,
            currentToolSessionId: null
          }
        }, false, 'truncateFromUserMessage')
      }
    }),
    {
      name: 'messages-store'
    }
  )
)
