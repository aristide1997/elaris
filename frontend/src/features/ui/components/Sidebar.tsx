import NewChatButton from '../../conversations/components/NewChatButton'
import ChatHistoryList from '../../conversations/components/ChatHistoryList'
import SettingsButton from './SettingsButton'
import { ElarisLogo } from '../index'
import { useUIStore } from '../stores/useUIStore'
import './Sidebar.css'

const Sidebar: React.FC = () => {
  const { toggleSidebar } = useUIStore()

  return (
    <div className="sidebar-container">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <ElarisLogo className="brand-logo" />
        </div>
        <button
          type="button"
          className="collapse-button"
          aria-label="Collapse sidebar"
          onClick={toggleSidebar}
          title="Collapse"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div className="quick-actions">
        <div className="qa-left">
          <NewChatButton />
        </div>
        <div className="qa-right">
          <button type="button" className="icon-button" aria-label="Search" title="Search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
          <SettingsButton />
        </div>
      </div>
      <div className="quick-actions-divider" />

      <div className="sidebar-content">
        <ChatHistoryList />
      </div>
    </div>
  )
}

export default Sidebar
