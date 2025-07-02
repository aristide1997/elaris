import React from 'react'
import { useChat } from '../context/ChatContext'
import ChatHeader from './ChatHeader'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'

const ChatWindow: React.FC = () => {
  const { messages, isConnected, sendMessage, openDebug, openHistory } = useChat()
  return (
    <>
      <ChatHeader
        isConnected={isConnected}
        onDebugClick={openDebug}
        onHistoryClick={openHistory}
      />
      <ChatMessages messages={messages} />
      <ChatInput onSendMessage={sendMessage} disabled={!isConnected} />
    </>
  )
}

export default ChatWindow 