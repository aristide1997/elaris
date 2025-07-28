import { useChatActions } from '../hooks/useChatActions'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'

const ChatWindow: React.FC = () => {
  const { messages, isConnected, conversationId, sendMessage, stopMessage, isStreaming } = useChatActions()
  
  return (
    <>
      <ChatMessages messages={messages} />
      <ChatInput
        onSendMessage={sendMessage}
        onStopMessage={stopMessage}
        disabled={!isConnected || isStreaming}
        isStreaming={isStreaming}
      />
    </>
  )
}

export default ChatWindow
