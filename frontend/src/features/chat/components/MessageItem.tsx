import { marked } from 'marked'
import type { UIMessage } from '../types'
import ToolContainer from './ToolContainer'
import ThinkingBubble from './ThinkingBubble'
import './MessageItem.css'

// Configure marked options
marked.setOptions({
  breaks: true, // Convert line breaks to <br>
  gfm: true, // Enable GitHub Flavored Markdown
})

interface MessageItemProps {
  message: UIMessage
}

function MessageItem({ message }: MessageItemProps) {
  const getMessageClassName = () => {
    switch (message.type) {
      case 'user':
        return 'message user-message'
      case 'assistant':
        return 'message assistant-message'
      case 'system':
        return 'message system-message'
      case 'thinking':
        return 'message thinking-message'
      case 'tool_session':
        return 'message tool-session-message'
      default:
        return 'message'
    }
  }

  const getSystemMessageClassName = () => {
    if (message.type === 'system') {
      return message.subtype === 'error' ? 'system-error' : 'system-info'
    }
    return ''
  }

  const renderMessageContent = () => {
    if (message.type === 'assistant') {
      // Render assistant messages as markdown
      const htmlContent = marked(message.content || '')
      return (
        <div 
          className={`message-content ${getSystemMessageClassName()}`}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )
    } else {
      // Render other message types as plain text
      return (
        <div className={`message-content ${getSystemMessageClassName()}`}>
          {message.content}
        </div>
      )
    }
  }

  return (
    <div className={getMessageClassName()}>
      {message.type === 'thinking' ? (
        // Thinking message - render as thinking bubble
        <ThinkingBubble thinking={message} />
      ) : message.type === 'tool_session' ? (
        // Tool session message - render tools with status
        <div className="tool-session-container">
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
      ) : (
        // Regular message rendering
        <>
          {message.tools && message.tools.length > 0 && (
            <ToolContainer tools={message.tools} />
          )}
          {renderMessageContent()}
        </>
      )}
    </div>
  )
}

export default MessageItem
