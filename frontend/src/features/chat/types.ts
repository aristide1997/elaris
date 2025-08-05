import type { ClientToServerMessage, ServerToClientMessage } from '../../protocol/messages'
import type { ToolInstance } from '../approval/types'

export interface BaseMessage {
  id: string
  timestamp: Date
  content?: string
  subtype?: string
  tools?: ToolInstance[]
  status?: 'executing' | 'completed' | 'blocked'
}

export interface SystemMessage extends BaseMessage {
  type: 'system'
  content: string
  subtype?: 'info' | 'error'
}

export interface ImageAttachment {
  id: string
  file: File
  url: string // blob URL for preview
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  size: number
  name: string
}

export interface UserMessage extends BaseMessage {
  type: 'user'
  content: string
  attachments?: ImageAttachment[]
}

export interface AssistantMessage extends BaseMessage {
  type: 'assistant'
  content: string
}

export interface ThinkingMessage extends BaseMessage {
  type: 'thinking'
  content: string
  isStreaming: boolean
  isCollapsed: boolean
}

export interface ToolSessionMessage extends BaseMessage {
  type: 'tool_session'
  tools: ToolInstance[]
  status: 'executing' | 'completed' | 'blocked'
}

export type UIMessage = SystemMessage | UserMessage | AssistantMessage | ThinkingMessage | ToolSessionMessage

export type MCPServerMessage = ServerToClientMessage
export type MCPClientMessage = ClientToServerMessage

// Message store state and actions
export interface MessagesState {
  messages: UIMessage[]
  currentAssistantId: string | null
  currentThinkingId: string | null
  currentToolSessionId: string | null
}

export interface MessagesActions {
  addMessage: (message: UIMessage) => void
  updateMessage: (id: string, updates: Partial<UIMessage>) => void
  setMessages: (messages: UIMessage[]) => void
  setCurrentAssistantId: (id: string | null) => void
  setCurrentThinkingId: (id: string | null) => void
  setCurrentToolSessionId: (id: string | null) => void
  initMessages: (messages: UIMessage[]) => void
  resetToWelcome: () => void
  getUserMessageIndex: (messageId: string) => number
  truncateFromUserMessage: (messageId: string) => void
}

export type MessagesStore = MessagesState & MessagesActions
