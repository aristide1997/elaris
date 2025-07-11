import type { SystemMessage, UserMessage, AssistantMessage, ThinkingMessage, ToolSessionMessage } from '../types'
import type { ToolInstance } from '../../approval/types'

export class MessageService {
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private static now(): Date {
    return new Date()
  }

  static systemMessage(content: string): SystemMessage {
    return {
      id: this.generateId(),
      type: 'system',
      content,
      timestamp: this.now()
    }
  }

  static userMessage(content: string): UserMessage {
    return {
      id: this.generateId(),
      type: 'user',
      content,
      timestamp: this.now()
    }
  }

  static assistantStart(): AssistantMessage {
    return {
      id: this.generateId(),
      type: 'assistant',
      content: '',
      timestamp: this.now()
    }
  }

  static appendAssistantDelta(
    message: AssistantMessage,
    delta: string
  ): AssistantMessage {
    return {
      ...message,
      content: (message.content ?? '') + delta
    }
  }

  static errorMessage(errorText: string): SystemMessage {
    return {
      id: this.generateId(),
      type: 'system',
      content: `❌ Error: ${errorText}`,
      subtype: 'error',
      timestamp: this.now()
    }
  }

  static thinkingStart(): ThinkingMessage {
    return {
      id: this.generateId(),
      type: 'thinking',
      content: '',
      isStreaming: true,
      isCollapsed: false,
      timestamp: this.now()
    }
  }

  static toolSessionMessage(): ToolSessionMessage {
    return {
      id: this.generateId(),
      type: 'tool_session',
      tools: [],
      status: 'executing',
      timestamp: this.now()
    }
  }

  static createToolInstance(
    toolId: string,
    name: string
  ): ToolInstance {
    return {
      id: toolId,
      name,
      status: 'pending_approval',
      timestamp: this.now()
    }
  }
}
