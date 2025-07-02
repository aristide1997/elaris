import React from 'react'
import { useChat } from '../context/ChatContext'
import './NewChatButton.css'

const NewChatButton: React.FC = () => {
  const { startNewChat } = useChat()

  return (
    <button className="new-chat-button" onClick={startNewChat}>
      <span className="new-chat-icon">➕</span>
      <span className="new-chat-text">New Chat</span>
    </button>
  )
}

export default NewChatButton
