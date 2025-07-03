import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { UIMessage, MessagesStore, MessagesState } from '../types'
import { MessageService } from '../services/MessageService'

const createWelcomeMessage = (): UIMessage => 
  MessageService.systemMessage('🤖 MCP Assistant ready! Start a conversation or ask me anything.')

const initialState: MessagesState = {
  messages: [createWelcomeMessage()],
  currentAssistantId: null,
  currentToolSessionId: null
}

export const useMessagesStore = create<MessagesStore>()(
  devtools(
    (set) => ({
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
          messages: [createWelcomeMessage()],
          currentAssistantId: null,
          currentToolSessionId: null
        }, false, 'resetToWelcome')
      }
    }),
    {
      name: 'messages-store'
    }
  )
) 