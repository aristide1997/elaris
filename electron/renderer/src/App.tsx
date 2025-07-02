import React, { useState } from 'react'
import Layout from './components/Layout'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import ChatHeader from './components/ChatHeader'
import Modals from './components/Modals'
import { useChat } from './context/ChatContext'
import './App.css'

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { isConnected, openDebug } = useChat()

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

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
