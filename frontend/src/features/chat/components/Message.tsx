import type { ReactNode } from 'react'
import './Message.css'

interface MessageProps {
  type: 'user' | 'assistant' | 'system'
  children: ReactNode
  name?: string
  timestamp?: Date | string | number
}

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

function formatTimestamp(timestamp?: Date | string | number) {
  if (!timestamp) {
    return { display: undefined, iso: undefined }
  }

  const date =
    timestamp instanceof Date ? timestamp : new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return { display: undefined, iso: undefined }
  }

  return {
    display: TIME_FORMATTER.format(date),
    iso: date.toISOString(),
  }
}

function Message({ type, children, name, timestamp }: MessageProps) {
  if (type === 'system') {
    return (
      <div className="message-row message-row--system">
        <div className="message-row__content">
          <div className="message-row__body">{children}</div>
        </div>
      </div>
    )
  }

  const fallbackName =
    type === 'user' ? 'You' : type === 'assistant' ? 'Assistant' : 'System'
  const displayName = name || fallbackName
  const { display: formattedTime, iso } = formatTimestamp(timestamp)

  return (
    <div className={`message-row message-row--${type}`}>
      <div className="message-row__content">
        <div className="message-row__header">
          <span className="message-row__author">{displayName}</span>
          {formattedTime && (
            <time className="message-row__timestamp" dateTime={iso}>
              {formattedTime}
            </time>
          )}
        </div>
        <div className="message-row__body">{children}</div>
      </div>
    </div>
  )
}

export default Message
