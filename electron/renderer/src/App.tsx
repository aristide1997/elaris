import React from 'react'
import Layout from './components/Layout'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import ChatHeader from './components/ChatHeader'
import Modals from './components/Modals'
import { useChatStore } from './stores/useChatStore'
import { useUIStore } from './stores/useUIStore'
import { useWebSocketConnection } from './hooks/useWebSocketConnection'
import './App.css'

function App() {
  // Initialize WebSocket connection and store integration
  useWebSocketConnection()
  
  const isConnected = useChatStore(state => state.isConnected)
  const { isSidebarCollapsed, toggleSidebar, openDebug } = useUIStore()

  return (
    <div className="app">
      <ChatHeader
        isConnected={isConnected}
        onDebugClick={openDebug}
        onToggleSidebar={toggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
      />
      <Layout sidebar={<Sidebar />} isSidebarCollapsed={isSidebarCollapsed}>
        <ChatWindow />
      </Layout>
      <Modals />
    </div>
  )
}

export default App
