import React, { useState } from 'react'
import type { ToolInstance } from '../../approval/types'
import './ToolContainer.css'

interface ToolContainerProps {
  tools: ToolInstance[]
}

function ToolContainer({ tools }: ToolContainerProps) {
  return (
    <div className="tool-container">
      {tools.map((tool, index) => (
        <ToolItem key={tool.id || `${tool.name}-${index}`} tool={tool} />
      ))}
    </div>
  )
}

interface ToolItemProps {
  tool: ToolInstance
}

function ToolItem({ tool }: ToolItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return { 
          dot: 'pending', 
          text: 'Awaiting approval' 
        }
      case 'executing':
        return { 
          dot: 'executing', 
          text: 'Executing' 
        }
      case 'completed':
        return { 
          dot: 'completed', 
          text: 'Completed' 
        }
      case 'blocked':
        return { 
          dot: 'blocked', 
          text: 'Blocked' 
        }
      default:
        return { 
          dot: 'pending', 
          text: status 
        }
    }
  }

  const statusInfo = getStatusInfo(tool.status)

  // For simple status display (no result)
  if (tool.status !== 'completed' || !tool.result) {
    return (
      <div className="tool-item">
        <div className="tool-item-inline">
          <div className={`tool-status-dot ${statusInfo.dot}`}></div>
          <span className="tool-name">{tool.name}</span>
          <span className="tool-status-text">— {statusInfo.text}</span>
        </div>
      </div>
    )
  }

  // For completed tools with results
  const lines = tool.result.split('\n')
  const lineCount = lines.length

  return (
    <div className="tool-item">
      <div 
        className={`tool-result-summary ${isExpanded ? 'expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="tool-result-info">
          <div className={`tool-status-dot ${statusInfo.dot}`}></div>
          <span className="tool-name">{tool.name}</span>
          <span className="tool-status-text">— {lineCount} line{lineCount !== 1 ? 's' : ''}</span>
        </div>
        <svg 
          className="tool-expand-icon" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      
      {isExpanded && (
        <div className="tool-result">
          <pre>{tool.result}</pre>
        </div>
      )}
    </div>
  )
}

export default ToolContainer
