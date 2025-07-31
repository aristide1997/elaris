import { useChatActions } from '../../chat/hooks/useChatActions'
import './NewChatButton.css'

const NewChatButton: React.FC = () => {
  const { resetConversation } = useChatActions()

  return (
    <button className="new-chat-button" onClick={resetConversation}>
      <span className="new-chat-icon">➕</span>
      <span className="new-chat-text">New Chat</span>
    </button>
  )
}

export default NewChatButton
