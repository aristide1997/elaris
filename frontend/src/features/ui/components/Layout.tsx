import React from 'react'
import './Layout.css'

interface LayoutProps {
  children: React.ReactNode
  sidebar: React.ReactNode
  isSidebarCollapsed: boolean
}

const Layout: React.FC<LayoutProps> = ({ children, sidebar, isSidebarCollapsed }) => {
  return (
    <div className={`layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {sidebar}
      </aside>
      
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}

export default Layout
