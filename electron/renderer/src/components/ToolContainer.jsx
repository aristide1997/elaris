import { useState } from 'react'
import './ToolContainer.css'

function ToolContainer({ tools }) {
  return (
    <div className="tool-container">
      {tools.map((tool, index) => (
        <ToolItem key={index} tool={tool} />
      ))}
    </div>
  )
}

function ToolItem({ tool }) {
  const [isExpanded, setIsExpanded] = useState(false)

  switch (tool.type) {
    case 'executing':
      return (
        <div className="tool-executing-inline">
          🔧 Executing tool: {tool.name}
        </div>
      )
    
    case 'blocked':
      return (
        <div className="tool-blocked-inline">
          ⛔ Tool blocked: {tool.name}
        </div>
      )
    
    case 'result':
      const lines = tool.content.split('\n')
      return (
        <details className="tool-result-details">
          <summary>
            Tool result: {lines.length} line{lines.length > 1 ? 's' : ''}
          </summary>
          <pre>{tool.content}</pre>
        </details>
      )
    
    case 'result_blocked':
      return (
        <div className="tool-blocked-inline">
          ⛔ Tool result blocked (tool was not approved)
        </div>
      )
    
    default:
      return null
  }
}

export default ToolContainer 