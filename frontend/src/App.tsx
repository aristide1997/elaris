import { useEffect } from 'react'
import { Layout, Sidebar, ChatHeader, useUIStore, useSettingsStore } from './features/ui'
import { ChatWindow } from './features/chat'
import { useConnectionStore } from './features/connection'
import { useWebSocketConnection } from './features/connection'
import { UpdateNotification } from './features/updater'
import { Modals } from './shared/components/Modals'
import './App.css'

function App() {
  // Initialize WebSocket connection and store integration
  useWebSocketConnection()
  
  const isConnected = useConnectionStore(state => state.status === 'connected')
  const { isSidebarCollapsed, toggleSidebar, openDebug } = useUIStore()
  const { settings, loadSettings } = useSettingsStore()

  // Load settings on app start - wait for backend connection
  useEffect(() => {
    if (isConnected) {
      loadSettings()
    }
  }, [isConnected, loadSettings])

  // Listen for settings updates from settings window
  useEffect(() => {
    if (!isConnected) return

    const handleSettingsUpdate = (event: any, updatedSettings: any) => {
      // Reload settings to ensure main window is synchronized
      loadSettings()
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
  }, [isConnected, loadSettings])

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
      <UpdateNotification />
    </div>
  )
}

export default App
