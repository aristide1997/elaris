import ToolContainer from './ToolContainer'
import './MessageItem.css'

function MessageItem({ message }) {
  const getMessageClassName = () => {
    switch (message.type) {
      case 'user':
        return 'message user-message'
      case 'assistant':
        return 'message assistant-message'
      case 'system':
        return 'message system-message'
      case 'tool_session':
        return 'message tool-session-message'
      default:
        return 'message'
    }
  }

  const getSystemMessageClassName = () => {
    if (message.type === 'system') {
      return message.subtype === 'error' ? 'system-error' : 'system-info'
    }
    return ''
  }

  return (
    <div className={getMessageClassName()}>
      {message.type === 'tool_session' ? (
        // Tool session message - render tools with status
        <div className="tool-session-container">
          <div className="tool-session-header">
            🔧 Tool Execution Phase
            <span className={`session-status ${message.status}`}>
              {message.status}
            </span>
          </div>
          {message.tools && message.tools.length > 0 && (
            <ToolContainer tools={message.tools} />
          )}
        </div>
      ) : (
        // Regular message rendering
        <>
          {message.tools && message.tools.length > 0 && (
            <ToolContainer tools={message.tools} />
          )}
          <div className={`message-content ${getSystemMessageClassName()}`}>
            {message.content}
          </div>
        </>
      )}
    </div>
  )
}

export default MessageItem
