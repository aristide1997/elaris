import React, { useEffect } from 'react'
import { Layout, Sidebar, ChatHeader, useUIStore, useSettingsStore } from './features/ui'
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
  const { settings, loadSettings } = useSettingsStore()

  // Load settings on app start
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return (
    <div className="app">
      <ChatHeader
        isConnected={isConnected}
        onDebugClick={openDebug}
        onToggleSidebar={toggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        debugMode={settings?.debug_mode ?? true}
      />
      <Layout sidebar={<Sidebar />} isSidebarCollapsed={isSidebarCollapsed}>
        <ChatWindow />
      </Layout>
      <Modals />
    </div>
  )
}

export default App
