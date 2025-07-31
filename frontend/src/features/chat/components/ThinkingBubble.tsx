import React, { useState, useEffect } from 'react'
import type { ThinkingMessage } from '../types'
import './ThinkingBubble.css'

interface ThinkingBubbleProps {
  thinking: ThinkingMessage
  onToggleCollapse?: () => void
}

function ThinkingBubble({ thinking, onToggleCollapse }: ThinkingBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(!thinking.isCollapsed)
  // Collapse the thinking bubble when thinking.isCollapsed toggles
  useEffect(() => {
    setIsExpanded(!thinking.isCollapsed)
  }, [thinking.isCollapsed])

  const handleToggle = () => {
    if (thinking.isCollapsed) {
      setIsExpanded(!isExpanded)
      onToggleCollapse?.()
    }
  }

  const renderThinkingContent = () => {
    if (thinking.isStreaming && !thinking.content) {
      return (
        <div className="thinking-placeholder">
          <div className="thinking-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="thinking-text">Thinking...</span>
        </div>
      )
    }

    if (thinking.isCollapsed && !isExpanded) {
      return (
        <div className="thinking-collapsed" onClick={handleToggle}>
          <span className="thinking-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21C9 21.5523 9.44772 22 10 22H14C14.5523 22 15 21.5523 15 21V20H9V21Z" fill="currentColor"/>
              <path d="M12 2C8.13401 2 5 5.13401 5 9C5 10.8906 5.74847 12.6094 7.00001 13.8438V17C7.00001 17.5523 7.44772 18 8.00001 18H16C16.5523 18 17 17.5523 17 17V13.8438C18.2515 12.6094 19 10.8906 19 9C19 5.13401 15.866 2 12 2Z" fill="currentColor"/>
            </svg>
          </span>
          <span className="thinking-summary">View thinking process</span>
          <span className="expand-icon">▶</span>
        </div>
      )
    }

    return (
      <div className="thinking-expanded">
        {thinking.isCollapsed && (
          <div className="thinking-header" onClick={handleToggle}>
            <span className="thinking-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21C9 21.5523 9.44772 22 10 22H14C14.5523 22 15 21.5523 15 21V20H9V21Z" fill="currentColor"/>
                <path d="M12 2C8.13401 2 5 5.13401 5 9C5 10.8906 5.74847 12.6094 7.00001 13.8438V17C7.00001 17.5523 7.44772 18 8.00001 18H16C16.5523 18 17 17.5523 17 17V13.8438C18.2515 12.6094 19 10.8906 19 9C19 5.13401 15.866 2 12 2Z" fill="currentColor"/>
              </svg>
            </span>
            <span className="thinking-title">Thinking process</span>
            <span className="collapse-icon">▼</span>
          </div>
        )}
        <div className="thinking-content">
          {thinking.content}
          {thinking.isStreaming && (
            <span className="thinking-cursor">|</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`thinking-bubble ${thinking.isStreaming ? 'streaming' : 'complete'} ${thinking.isCollapsed ? 'collapsed' : 'expanded'}`}>
      {renderThinkingContent()}
    </div>
  )
}

export default ThinkingBubble
