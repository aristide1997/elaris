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
      {message.tools && message.tools.length > 0 && (
        <ToolContainer tools={message.tools} />
      )}
      <div className={`message-content ${getSystemMessageClassName()}`}>
        {message.content}
      </div>
    </div>
  )
}

export default MessageItem 