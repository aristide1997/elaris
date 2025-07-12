import React, { useEffect } from 'react'
import { Layout, Sidebar, ChatHeader, useUIStore, useSettingsStore, useLLMProviderStore } from './features/ui'
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
  const { loadCurrentProvider } = useLLMProviderStore()

  // Load settings on app start
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Listen for settings updates from settings window
  useEffect(() => {
    const handleSettingsUpdate = (event: any, updatedSettings: any) => {
      // Reload settings to ensure main window is synchronized
      loadSettings()
      // Also reload the current provider to refresh the model picker
      loadCurrentProvider()
    }

    if (window.electronAPI?.onSettingsUpdated) {
      window.electronAPI.onSettingsUpdated(handleSettingsUpdate)
    }

    // Cleanup listener on unmount
    return () => {
      if (window.electronAPI?.removeAllListeners) {
        window.electronAPI.removeAllListeners('settings-updated')
      }
    }
  }, [loadSettings, loadCurrentProvider])

  return (
    <div className="app">
      <ChatHeader
        isConnected={isConnected}
        onDebugClick={openDebug}
        onToggleSidebar={toggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        debugMode={settings?.debug_mode ?? false}
      />
      <Layout sidebar={<Sidebar />} isSidebarCollapsed={isSidebarCollapsed}>
        <ChatWindow />
      </Layout>
      <Modals />
    </div>
  )
}

export default App
