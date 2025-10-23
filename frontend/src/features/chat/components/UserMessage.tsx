import { useState } from 'react'
import type { UserMessage as UserMessageType } from '../types'
import ImagePreview from './ImagePreview'
import { useChatActions } from '../hooks/useChatActions'
import './UserMessage.css'

interface UserMessageProps {
  message: UserMessageType
}

function UserMessage({ message }: UserMessageProps) {
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

  if (isEditing) {
    return (
      <div className="user-message-edit">
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="user-message-edit__textarea"
          autoFocus
          rows={3}
        />
        <div className="user-message-edit__buttons">
          <button 
            onClick={handleEditSave}
            className="user-message-edit__button user-message-edit__button--save"
            disabled={!editContent.trim() || editContent === message.content}
          >
            Save
          </button>
          <button 
            onClick={handleEditCancel}
            className="user-message-edit__button user-message-edit__button--cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="user-message-content">
      {message.attachments && message.attachments.length > 0 && (
        <ImagePreview images={message.attachments} readonly />
      )}
      <span className="user-message-content__text">{message.content}</span>
      {!isStreaming && (
        <button 
          onClick={handleEditClick}
          className="user-message-content__edit-btn"
          title="Edit message"
        >
          ✏️
        </button>
      )}
    </div>
  )
}

export default UserMessage
