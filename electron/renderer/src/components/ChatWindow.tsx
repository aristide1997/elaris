import React from 'react'
import { useChatStore } from '../stores/useChatStore'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'

const ChatWindow: React.FC = () => {
  const messages = useChatStore(state => state.messages)
  const isConnected = useChatStore(state => state.isConnected)
  const conversationId = useChatStore(state => state.conversationId)
  const sendMessage = useChatStore(state => state.sendMessage)
  
  return (
    <>
      <ChatMessages messages={messages} />
      <ChatInput
        onSendMessage={sendMessage}
        disabled={!isConnected || !conversationId}
      />
    </>
  )
}

export default ChatWindow
