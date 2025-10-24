import { useEffect, useRef } from 'react'
import * as ScrollArea from '@radix-ui/react-scroll-area'
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
    <ScrollArea.Root className="chat-scroll-area" type="auto">
      <ScrollArea.Viewport className="chat-container">
        <div className="messages">
          {messageGroups.map((group, groupIndex) => {
            const groupTimestamp = group.messages[0]?.timestamp

            if (group.type === 'user') {
              // User messages
              return group.messages.map((message) => (
                <Message
                  key={message.id}
                  type="user"
                  name="You"
                  timestamp={message.timestamp}
                >
                  <UserMessage message={message as any} />
                </Message>
              ))
            } else if (group.type === 'system') {
              // System messages
              return group.messages.map((message) => (
                <Message
                  key={message.id}
                  type="system"
                  timestamp={message.timestamp}
                >
                  {message.content}
                </Message>
              ))
            } else {
              // Assistant message group (thinking, tools, text)
              return (
                <Message
                  key={`group-${groupIndex}`}
                  type="assistant"
                  name="Elaris Assistant"
                  timestamp={groupTimestamp}
                >
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
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="chat-scrollbar"
      >
        <ScrollArea.Thumb className="chat-scrollbar-thumb" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner className="chat-scrollbar-corner" />
    </ScrollArea.Root>
  )
}

export default ChatMessages
