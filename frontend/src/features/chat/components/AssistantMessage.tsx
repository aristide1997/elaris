import { marked } from 'marked'
import type { AssistantMessage as AssistantMessageType } from '../types'
import './AssistantMessage.css'

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
})

interface AssistantMessageProps {
  message: AssistantMessageType
}

function AssistantMessage({ message }: AssistantMessageProps) {
  const htmlContent = marked(message.content || '')
  
  return (
    <div 
      className="assistant-message-content"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}

export default AssistantMessage
