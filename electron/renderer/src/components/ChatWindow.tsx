import React from 'react'
import { useChat } from '../context/ChatContext'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'

const ChatWindow: React.FC = () => {
  const { messages, isConnected, sendMessage } = useChat()
  return (
    <>
      <ChatMessages messages={messages} />
      <ChatInput onSendMessage={sendMessage} disabled={!isConnected} />
    </>
  )
}

export default ChatWindow
