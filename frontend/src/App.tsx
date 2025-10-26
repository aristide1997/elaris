import { useEffect } from 'react'
import { Layout, Sidebar, useUIStore, useSettingsStore } from './features/ui'
import { ChatWindow } from './features/chat'
import { useConnectionStore } from './features/connection'
import { useWebSocketConnection } from './features/connection'
import { UpdateNotification } from './features/updater'
import { Modals } from './shared/components/Modals'
import { useKeyboardShortcuts } from './shared/hooks/useKeyboardShortcuts'
import { queryClient } from './shared/api/queryClient'
import { llmProviderKeys } from './shared/api/queries'
import './App.css'

function App() {
  // Initialize WebSocket connection and store integration
  useWebSocketConnection()
  
  // Initialize global keyboard shortcuts
  useKeyboardShortcuts()
  
  const isConnected = useConnectionStore(state => state.status === 'connected')
  const { isSidebarCollapsed } = useUIStore()
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

    const handleSettingsUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: llmProviderKeys.all })
      // Reload settings to ensure main window is synchronized
      void loadSettings()
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
      <Layout sidebar={<Sidebar />} isSidebarCollapsed={isSidebarCollapsed}>
        <ChatWindow />
      </Layout>
      <Modals />
      <UpdateNotification />
    </div>
  )
}

export default App
