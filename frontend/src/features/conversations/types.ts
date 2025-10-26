import type { UIMessage } from '../chat/types'

export interface ConversationState {
  conversationId: string | null
}

export interface ConversationActions {
  setConversationId: (id: string | null) => void
  selectConversation: (id: string, serverPort: number | null, onMessagesLoaded: (messages: UIMessage[]) => void, onReset: () => void) => Promise<void>
  startNewChat: (serverPort: number | null, onError: (message: string) => void, onReset: () => void) => Promise<void>
}

export type ConversationStore = ConversationState & ConversationActions
