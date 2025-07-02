import type { UIMessage, ToolInstance } from '../types'
import { MessageService } from '../services/MessageService'

interface ChatState {
  messages: UIMessage[]
  currentAssistantId: string | null
  currentToolSessionId: string | null
}

// Discriminated union of all chat action types for strong typing
type ChatAction =
  | { type: 'system_ready'; payload: { message: string } }
  | { type: 'assistant_start' }
  | { type: 'text_delta'; payload: { content: string } }
  | { type: 'assistant_complete' }
  | { type: 'tool_session_start' }
  | { type: 'tool_start'; payload: { tool_id: string; tool_name: string } }
  | { type: 'tool_complete'; payload: { tool_id: string; content: string } }
  | { type: 'tool_blocked'; payload: { tool_id: string } }
  | { type: 'tool_error'; payload: { tool_id: string; tool_name: string; error: string } }
  | { type: 'approval_request'; payload: { tool_id: string } }
  | { type: 'tool_session_complete' }
  | { type: 'error'; payload: { message: string } }
  | { type: 'add_user'; payload: { content: string } }
  | { type: 'approval_response'; payload: { tool_id: string; approved: boolean } }
  | { type: 'init_messages'; payload: { messages: UIMessage[] } };

export function messageReducer(
  state: ChatState,
  action: ChatAction
): ChatState {
  switch (action.type) {
    case 'system_ready': {
      const msg = MessageService.systemMessage(action.payload.message)
      return { ...state, messages: [...state.messages, msg] }
    }

    case 'assistant_start': {
      if (!state.currentAssistantId) {
        const newMsg = MessageService.assistantStart()
        return {
          ...state,
          messages: [...state.messages, newMsg],
          currentAssistantId: newMsg.id
        }
      }
      return state
    }

    case 'text_delta': {
      let assistantId = state.currentAssistantId
      let messages = state.messages
      if (!assistantId) {
        const fallback = MessageService.assistantStart()
        assistantId = fallback.id
        messages = [...messages, fallback]
      }
      messages = messages.map(m =>
        m.id === assistantId
          ? MessageService.appendAssistantDelta(m as any, action.payload.content)
          : m
      )
      return { ...state, messages, currentAssistantId: assistantId }
    }

    case 'assistant_complete':
      return { ...state, currentAssistantId: null }

    case 'tool_session_start': {
      const session = MessageService.toolSessionMessage()
      return {
        ...state,
        messages: [...state.messages, session],
        currentToolSessionId: session.id
      }
    }

    case 'tool_start': {
      const { tool_id, tool_name } = action.payload
      if (!state.currentToolSessionId) return state
      const messages = state.messages.map(m => {
        if (m.id === state.currentToolSessionId) {
          return {
            ...m,
            tools: [...(m.tools ?? []), MessageService.createToolInstance(tool_id, tool_name)]
          } as UIMessage
        }
        return m
      })
      return { ...state, messages }
    }

    case 'tool_complete': {
      const { tool_id, content } = action.payload
      if (!state.currentToolSessionId) return state
      const messages = state.messages.map(m => {
        if (m.id === state.currentToolSessionId) {
          return {
            ...m,
            status: 'completed',
            tools: (m.tools ?? []).map((t: ToolInstance) =>
              t.id === tool_id
                ? ({ ...t, status: 'completed', result: content } as ToolInstance)
                : t
            ),
          } as UIMessage
        }
        return m
      })
      return { ...state, messages }
    }

    case 'tool_blocked': {
      const { tool_id } = action.payload
      if (!state.currentToolSessionId) return state
      const messages = state.messages.map(m => {
        if (m.id === state.currentToolSessionId) {
          return {
            ...m,
            status: 'blocked',
            tools: (m.tools ?? []).map((t: ToolInstance) =>
              t.id === tool_id
                ? ({ ...t, status: 'blocked' } as ToolInstance)
                : t
            ),
          } as UIMessage
        }
        return m
      })
      return { ...state, messages }
    }

    case 'approval_request': {
      const { tool_id } = action.payload
      const messages = state.messages.map(m => {
        if (m.type === 'tool_session') {
          return {
            ...m,
            tools: (m.tools ?? []).map((t: ToolInstance) =>
              t.id === tool_id
                ? ({ ...t, status: 'pending_approval' } as ToolInstance)
                : t
            )
          } as UIMessage
        }
        return m
      })
      return { ...state, messages }
    }

    case 'tool_session_complete': {
      if (!state.currentToolSessionId) return state
      const messages = state.messages.map(m => {
        if (m.id === state.currentToolSessionId) {
          const blocked = (m.tools ?? []).some((t) => t.status === 'blocked')
          return {
            ...m,
            status: blocked ? 'blocked' : 'completed'
          } as UIMessage
        }
        return m
      })
      return { ...state, messages, currentToolSessionId: null }
    }

    case 'error': {
      const msg = MessageService.errorMessage(action.payload.message)
      return { ...state, messages: [...state.messages, msg] }
    }

    case 'add_user': {
      const msg = MessageService.userMessage(action.payload.content)
      return { ...state, messages: [...state.messages, msg] }
    }

    case 'approval_response': {
      const { tool_id, approved } = action.payload
      if (!state.currentToolSessionId) return state
      const messages = state.messages.map(m => {
        if (m.id === state.currentToolSessionId) {
          let updated = false
          return {
            ...m,
            tools: (m.tools ?? []).map((t: ToolInstance) => {
              if (!updated && t.id === tool_id && t.status === 'pending_approval') {
                updated = true
                return { ...t, status: approved ? 'executing' : 'blocked' } as ToolInstance
              }
              return t
            })
          } as UIMessage
        }
        return m
      })
      return { ...state, messages }
    }

    case 'init_messages':
      return { messages: action.payload.messages, currentAssistantId: null, currentToolSessionId: null }

    default:
      return state
  }
} 