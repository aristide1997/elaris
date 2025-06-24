import React, { useState, useRef, useEffect, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react'
import './ChatInput.css'

interface ChatInputProps {
  onSendMessage: (content: string) => void
  disabled: boolean
}

function ChatInput({ onSendMessage, disabled }: ChatInputProps): React.ReactElement {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (message.trim() && !disabled) {
        onSendMessage(message.trim())
        setMessage('')
      }
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    setMessage(e.target.value)
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current
      el.style.setProperty('height', 'auto')
      el.style.setProperty('height', `${el.scrollHeight}px`)
    }
  }, [message])

  return (
    <div className="input-container">
      <form className="input-wrapper" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message here..."
          rows={1}
          disabled={disabled}
          className="message-input"
        />
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="send-button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22,2 15,22 11,13 2,9"></polygon>
          </svg>
        </button>
      </form>
    </div>
  )
}

export default ChatInput 