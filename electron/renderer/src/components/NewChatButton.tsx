import React from 'react'
import { useChatStore } from '../stores/useChatStore'
import './NewChatButton.css'

const NewChatButton: React.FC = () => {
  const startNewChat = useChatStore(state => state.startNewChat)

  return (
    <button className="new-chat-button" onClick={startNewChat}>
      <span className="new-chat-icon">➕</span>
      <span className="new-chat-text">New Chat</span>
    </button>
  )
}

export default NewChatButton
