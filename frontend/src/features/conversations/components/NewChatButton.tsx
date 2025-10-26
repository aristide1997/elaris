import { useChatActions } from '../../chat/hooks/useChatActions'

const NewChatButton: React.FC = () => {
  const { resetConversation } = useChatActions()
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const shortcut = isMac ? '⌘N' : 'Ctrl+N'

  return (
    <button className="sidebar-button" onClick={resetConversation} title={`New chat - ${shortcut}`} aria-label="New chat" type="button">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      <span className="sidebar-button-text">New chat</span>
      <span className="sidebar-button-shortcut">{shortcut}</span>
    </button>
  )
}

export default NewChatButton
