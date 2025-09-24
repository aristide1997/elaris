import { useUIStore } from '../stores/useUIStore'
import { useChatActions } from '../../chat/hooks/useChatActions'
import './ChatHeader.css'

const ChatHeader: React.FC = () => {
  const { isSidebarCollapsed, toggleSidebar } = useUIStore()
  const { resetConversation } = useChatActions()

  return (
    <div className="chat-header">
      <div className="chat-header-left">
        {isSidebarCollapsed && (
          <button
            type="button"
            className="icon-button expand-sidebar-button"
            aria-label="Expand sidebar"
            onClick={toggleSidebar}
            title="Expand sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
        <button 
          type="button" 
          className="icon-button new-chat-button" 
          onClick={resetConversation} 
          title="New chat" 
          aria-label="New chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default ChatHeader
