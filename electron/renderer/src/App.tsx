import React from 'react'
import { Layout, Sidebar, ChatHeader, useUIStore } from './features/ui'
import { ChatWindow } from './features/chat'
import { useConnectionStore } from './features/connection'
import { useWebSocketConnection } from './features/connection'
import { Modals } from './shared/components/Modals'
import './App.css'

function App() {
  // Initialize WebSocket connection and store integration
  useWebSocketConnection()
  
  const isConnected = useConnectionStore(state => state.isConnected)
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
