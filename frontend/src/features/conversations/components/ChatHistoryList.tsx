import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChatActions } from '../../chat/hooks/useChatActions'
import { useConversationsQuery, useDeleteConversationMutation, conversationKeys } from '../../../shared/api/queries'
import { useSearchStore } from '../../ui/stores/useSearchStore'
import './ChatHistoryList.css'

const ChatHistoryList: React.FC = () => {
  const { selectConversation, conversationId } = useChatActions()
  const { query: searchQuery } = useSearchStore()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  
  // Use React Query for conversations
  const { 
    data: conversations = [], 
    isLoading, 
    error 
  } = useConversationsQuery(20)
  
  const deleteConversationMutation = useDeleteConversationMutation()

  // Listen for conversationCreated events to refresh the list
  useEffect(() => {
    const handleConversationCreated = () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    }

    window.addEventListener('conversationCreated', handleConversationCreated)
    
    return () => {
      window.removeEventListener('conversationCreated', handleConversationCreated)
    }
  }, [queryClient])

  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId)
  }

  const handleDeleteConversation = async (targetConversationId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent selecting the conversation
    setDeletingId(targetConversationId)
    
    try {
      await deleteConversationMutation.mutateAsync(targetConversationId)
      
      // If this was the active conversation, clear it
      if (targetConversationId === conversationId) {
        selectConversation('')
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

  if (error) {
    return (
      <div className="chat-history-error">
        <p>Failed to load conversations</p>
        <p className="error-message">{error.message}</p>
      </div>
    )
  }

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conv => 
    !searchQuery || conv.preview?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="chat-history-list">
      <div className="chat-history-items">
        {conversations.length === 0 ? (
          <div className="no-conversations">
            <p>No conversations yet</p>
            <p className="no-conversations-subtitle">Start a new chat to begin</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="no-conversations">
            <p>No conversations found</p>
            <p className="no-conversations-subtitle">Try a different search term</p>
          </div>
        ) : (
          filteredConversations.map(conv => (
            <div
              key={conv.conversation_id}
              className="chat-history-item-container"
            >
              <button
                onClick={() => handleSelectConversation(conv.conversation_id)}
                className={`chat-history-item ${conversationId === conv.conversation_id ? 'selected' : ''}`}
                title={conv.preview}
              >
                <div className="chat-preview">
                  {conv.preview || 'New conversation'}
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
