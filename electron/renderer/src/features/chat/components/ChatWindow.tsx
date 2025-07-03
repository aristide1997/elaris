import React from 'react'
import { useChatActions } from '../hooks/useChatActions'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'

const ChatWindow: React.FC = () => {
  const { messages, isConnected, conversationId, sendMessage } = useChatActions()
  
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
