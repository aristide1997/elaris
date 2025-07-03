import React from 'react'
import { useChatActions } from '../../chat/hooks/useChatActions'
import './NewChatButton.css'

const NewChatButton: React.FC = () => {
  const { startNewChat } = useChatActions()

  return (
    <button className="new-chat-button" onClick={startNewChat}>
      <span className="new-chat-icon">➕</span>
      <span className="new-chat-text">New Chat</span>
    </button>
  )
}

export default NewChatButton
