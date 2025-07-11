import React, { useState } from 'react'
import type { ThinkingMessage } from '../types'
import './ThinkingBubble.css'

interface ThinkingBubbleProps {
  thinking: ThinkingMessage
  onToggleCollapse?: () => void
}

function ThinkingBubble({ thinking, onToggleCollapse }: ThinkingBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(!thinking.isCollapsed)

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
          <span className="thinking-icon">🤔</span>
          <span className="thinking-summary">View thinking process</span>
          <span className="expand-icon">▶</span>
        </div>
      )
    }

    return (
      <div className="thinking-expanded">
        {thinking.isCollapsed && (
          <div className="thinking-header" onClick={handleToggle}>
            <span className="thinking-icon">🤔</span>
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
