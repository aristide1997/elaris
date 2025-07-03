import React, { useState, useEffect, ReactElement } from 'react'
import { useChatActions } from '../../chat/hooks/useChatActions'
import './ConversationListModal.css'

interface ConversationSummary {
  conversation_id: string
  created_at: string
  updated_at: string
  message_count: number
  preview: string
}

interface ConversationListModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (id: string) => void
  serverPort: number | null
}

function ConversationListModal({ isOpen, onClose, onSelect }: Omit<ConversationListModalProps, 'serverPort'>): ReactElement | null {
  const { serverPort } = useChatActions()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])

  useEffect(() => {
    if (isOpen) {
      const url = serverPort
        ? `http://localhost:${serverPort}/api/conversations?limit=20`
        : `/api/conversations?limit=20`
      fetch(url)
        .then(res => res.json())
        .then(data => setConversations(data.conversations || []))
        .catch(console.error)
    }
  }, [isOpen, serverPort])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Conversations</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <ul className="conversation-list">
            {conversations.map(conv => (
              <li key={conv.conversation_id} className="conversation-item">
                <button
                  onClick={() => { onSelect(conv.conversation_id); }}
                  className="conversation-button"
                >
                  <span className="conversation-date">{new Date(conv.updated_at).toLocaleString()}</span>
                  <span className="conversation-preview">{conv.preview}</span>
                  <span className="conversation-count">({conv.message_count})</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ConversationListModal 