import React, { useState, useEffect } from 'react'
import { useChat } from '../context/ChatContext'
import './ChatHistoryList.css'

interface ConversationSummary {
  conversation_id: string
  created_at: string
  updated_at: string
  message_count: number
  preview: string
}

const ChatHistoryList: React.FC = () => {
  const { selectConversation, serverPort, conversationId } = useChat()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true)
      try {
        const url = serverPort
          ? `http://localhost:${serverPort}/api/conversations?limit=20`
          : `/api/conversations?limit=20`
        const res = await fetch(url)
        const data = await res.json()
        setConversations(data.conversations || [])
      } catch (error) {
        console.error('Failed to fetch conversations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConversations()
  }, [serverPort, conversationId])

  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId)
  }

  const handleDeleteConversation = async (targetConversationId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent selecting the conversation
    setDeletingId(targetConversationId)
    
    try {
      const url = serverPort
        ? `http://localhost:${serverPort}/api/conversations/${targetConversationId}`
        : `/api/conversations/${targetConversationId}`
      
      const response = await fetch(url, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Remove from local state
        setConversations(prev => prev.filter(conv => conv.conversation_id !== targetConversationId))
        
        // If this was the active conversation, clear it
        if (targetConversationId === conversationId) {
          selectConversation('')
        }
      } else {
        console.error('Failed to delete conversation')
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="chat-history-loading">
        <div className="loading-spinner"></div>
        <span>Loading conversations...</span>
      </div>
    )
  }

  return (
    <div className="chat-history-list">
      <div className="chat-history-header">
        <h3>Recent Chats</h3>
      </div>
      
      <div className="chat-history-items">
        {conversations.length === 0 ? (
          <div className="no-conversations">
            <p>No conversations yet</p>
            <p className="no-conversations-subtitle">Start a new chat to begin</p>
          </div>
        ) : (
          conversations.map(conv => (
            <div
              key={conv.conversation_id}
              className="chat-history-item-container"
            >
              <button
                onClick={() => handleSelectConversation(conv.conversation_id)}
                className="chat-history-item"
                title={conv.preview}
              >
                <div className="chat-preview">
                  {conv.preview || 'New conversation'}
                </div>
                <div className="chat-meta">
                  <span className="chat-date">
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </span>
                  <span className="chat-count">
                    {conv.message_count} msgs
                  </span>
                </div>
              </button>
              <button
                onClick={(e) => handleDeleteConversation(conv.conversation_id, e)}
                className="delete-button"
                disabled={deletingId === conv.conversation_id}
                title="Delete conversation"
              >
                {deletingId === conv.conversation_id ? (
                  <div className="delete-spinner"></div>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ChatHistoryList
