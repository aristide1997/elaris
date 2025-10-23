import { useEffect, useRef } from 'react'
import type { UIMessage } from '../types'
import Message from './Message'
import UserMessage from './UserMessage'
import AssistantMessage from './AssistantMessage'
import ThinkingBubble from './ThinkingBubble'
import ToolContainer from './ToolContainer'
import './ChatMessages.css'

interface ChatMessagesProps {
  messages: UIMessage[]
}

interface MessageGroup {
  type: 'user' | 'assistant' | 'system'
  messages: UIMessage[]
}

function ChatMessages({ messages }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Group consecutive assistant-related messages together
  const groupMessages = (messages: UIMessage[]): MessageGroup[] => {
    const groups: MessageGroup[] = []
    let currentGroup: MessageGroup | null = null

    messages.forEach((message) => {
      const messageGroupType = 
        message.type === 'user' ? 'user' :
        message.type === 'system' ? 'system' :
        'assistant' // thinking, tool_session, assistant all grouped as 'assistant'

      if (currentGroup && currentGroup.type === messageGroupType && messageGroupType === 'assistant') {
        // Add to existing assistant group
        currentGroup.messages.push(message)
      } else {
        // Start new group
        if (currentGroup) {
          groups.push(currentGroup)
        }
        currentGroup = {
          type: messageGroupType,
          messages: [message]
        }
      }
    })

    // Push the last group
    if (currentGroup) {
      groups.push(currentGroup)
    }

    return groups
  }

  const messageGroups = groupMessages(messages)

  return (
    <div className="chat-container">
      <div className="messages">
        {messageGroups.map((group, groupIndex) => {
          if (group.type === 'user') {
            // User messages
            return group.messages.map((message) => (
              <Message key={message.id} type="user">
                <UserMessage message={message as any} />
              </Message>
            ))
          } else if (group.type === 'system') {
            // System messages
            return group.messages.map((message) => (
              <Message key={message.id} type="system">
                {message.content}
              </Message>
            ))
          } else {
            // Assistant message group (thinking, tools, text)
            return (
              <Message key={`group-${groupIndex}`} type="assistant">
                {group.messages.map((message) => {
                  if (message.type === 'thinking') {
                    return <ThinkingBubble key={message.id} thinking={message as any} />
                  } else if (message.type === 'tool_session') {
                    return (
                      <div key={message.id} className="tool-session-wrapper">
                        <div className="tool-session-header">
                          🔧 Tool Execution Phase
                          <span className={`session-status ${message.status}`}>
                            {message.status}
                          </span>
                        </div>
                        {message.tools && message.tools.length > 0 && (
                          <ToolContainer tools={message.tools} />
                        )}
                      </div>
                    )
                  } else if (message.type === 'assistant') {
                    return <AssistantMessage key={message.id} message={message as any} />
                  }
                  return null
                })}
              </Message>
            )
          }
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

export default ChatMessages
