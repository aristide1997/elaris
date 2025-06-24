import React, { useState } from 'react'
import type { UIMessage } from '../types'
import './MessageHistoryModal.css'

interface MessageHistoryModalProps {
  messages: UIMessage[]
  isOpen: boolean
  onClose: () => void
}

function MessageHistoryModal({ messages, isOpen, onClose }: MessageHistoryModalProps) {
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const toggleExpanded = (messageId: string): void => {
    setExpandedMessage(expandedMessage === messageId ? null : messageId)
  }

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleString()
  }

  const formatMessageForDisplay = (message: UIMessage): string => {
    const { id, type, content, timestamp, tools, subtype, ...rest } = message
    const displayObj = {
      id,
      type,
      ...(subtype && { subtype }),
      content: content || '',
      timestamp: formatTimestamp(timestamp),
      ...(tools && tools.length > 0 && { tools }),
      ...rest
    }
    return JSON.stringify(displayObj, null, 2)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e: React.MouseEvent<HTMLDivElement>): void => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Message History Debug View</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="messages-summary">
            <p><strong>Total Messages:</strong> {messages.length}</p>
            <p><strong>Message Types:</strong></p>
            <ul>
              <li>User: {messages.filter(m => m.type === 'user').length}</li>
              <li>Assistant: {messages.filter(m => m.type === 'assistant').length}</li>
              <li>System: {messages.filter(m => m.type === 'system').length}</li>
            </ul>
          </div>

          <div className="messages-list">
            <h3>All Messages:</h3>
            {messages.map((message, index) => (
              <div key={message.id} className="message-debug-item">
                <div 
                  className="message-header-debug"
                  onClick={() => toggleExpanded(message.id)}
                >
                  <span className="message-index">#{index + 1}</span>
                  <span className={`message-type-badge ${message.type}`}>
                    {message.type}
                  </span>
                  <span className="message-preview">
                    {message.content ? 
                      (message.content.length > 50 ? 
                        message.content.substring(0, 50) + '...' : 
                        message.content
                      ) : 
                      '<empty>'
                    }
                  </span>
                  <span className="expand-icon">
                    {expandedMessage === message.id ? '▼' : '▶'}
                  </span>
                </div>
                
                {expandedMessage === message.id && (
                  <div className="message-details">
                    <pre className="message-json">
                      {formatMessageForDisplay(message)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MessageHistoryModal
