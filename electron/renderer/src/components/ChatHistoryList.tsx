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
            <button
              key={conv.conversation_id}
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
          ))
        )}
      </div>
    </div>
  )
}

export default ChatHistoryList
