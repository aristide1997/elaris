import { useChatActions } from '../../chat/hooks/useChatActions'

const NewChatButton: React.FC = () => {
  const { resetConversation } = useChatActions()

  return (
    <button className="icon-button" onClick={resetConversation} title="New chat" aria-label="New chat" type="button">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  )
}

export default NewChatButton
