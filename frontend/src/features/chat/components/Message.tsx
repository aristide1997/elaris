import type { ReactNode } from 'react'
import './Message.css'

interface MessageProps {
  type: 'user' | 'assistant' | 'system'
  children: ReactNode
}

function Message({ type, children }: MessageProps) {
  return (
    <div className={`message-container message-container--${type}`}>
      {children}
    </div>
  )
}

export default Message
