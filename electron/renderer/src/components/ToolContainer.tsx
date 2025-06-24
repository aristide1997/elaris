import React, { useState } from 'react'
import type { ToolInstance } from '../types'
import './ToolContainer.css'

interface ToolContainerProps {
  tools: ToolInstance[]
}

function ToolContainer({ tools }: ToolContainerProps) {
  return (
    <div className="tool-container">
      {tools.map((tool) => (
        <ToolItem key={tool.id || tool.name} tool={tool} />
      ))}
    </div>
  )
}

interface ToolItemProps {
  tool: ToolInstance
}

function ToolItem({ tool }: ToolItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  switch (tool.status) {
    case 'pending_approval':
      return (
        <div className="tool-pending-inline">
          ⏳ Awaiting approval: {tool.name}
        </div>
      )
    
    case 'executing':
      return (
        <div className="tool-executing-inline">
          🔧 Executing tool: {tool.name}
        </div>
      )
    
    case 'completed':
      if (tool.result) {
        const lines = tool.result.split('\n')
        return (
          <details className="tool-result-details">
            <summary>
              ✅ {tool.name}: {lines.length} line{lines.length > 1 ? 's' : ''}
            </summary>
            <pre>{tool.result}</pre>
          </details>
        )
      } else {
        return (
          <div className="tool-completed-inline">
            ✅ {tool.name} completed
          </div>
        )
      }
    
    case 'blocked':
      return (
        <div className="tool-blocked-inline">
          ⛔ Tool blocked: {tool.name}
        </div>
      )
    
    case 'error':
      return (
        <div className="tool-error-inline">
          ❌ Tool error: {tool.name} - {tool.result || 'Unknown error'}
        </div>
      )
    
    default:
      return (
        <div className="tool-unknown-inline">
          ❓ {tool.name}: {tool.status}
        </div>
      )
  }
}

export default ToolContainer
