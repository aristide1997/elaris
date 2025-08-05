import { marked } from 'marked'
import { useState } from 'react'
import type { UIMessage } from '../types'
import ToolContainer from './ToolContainer'
import ThinkingBubble from './ThinkingBubble'
import ImagePreview from './ImagePreview'
import { useChatActions } from '../hooks/useChatActions'
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
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content || '')
  const { editMessage, isStreaming } = useChatActions()

  const handleEditClick = () => {
    setEditContent(message.content || '')
    setIsEditing(true)
  }

  const handleEditSave = () => {
    if (editContent.trim() && editContent !== message.content) {
      editMessage(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleEditCancel = () => {
    setEditContent(message.content || '')
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSave()
    } else if (e.key === 'Escape') {
      handleEditCancel()
    }
  }

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
    // Handle editing mode for user messages
    if (message.type === 'user' && isEditing) {
      return (
        <div className="message-edit-container">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="message-edit-textarea"
            autoFocus
            rows={3}
          />
          <div className="message-edit-buttons">
            <button 
              onClick={handleEditSave}
              className="edit-save-btn"
              disabled={!editContent.trim() || editContent === message.content}
            >
              Save
            </button>
            <button 
              onClick={handleEditCancel}
              className="edit-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

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
          {message.type === 'user' && message.attachments && message.attachments.length > 0 && (
            <ImagePreview images={message.attachments} readonly />
          )}
          {message.content}
          {message.type === 'user' && !isStreaming && (
            <button 
              onClick={handleEditClick}
              className="message-edit-btn"
              title="Edit message"
            >
              ✏️
            </button>
          )}
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
