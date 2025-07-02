import React, { createContext, useContext, ReactNode } from 'react'
import { useConversation } from '../hooks/useConversation'

export type ChatContextValue = ReturnType<typeof useConversation>

const ChatContext = createContext<ChatContextValue | undefined>(undefined)

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const value = useConversation()
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export const useChat = (): ChatContextValue => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
} 