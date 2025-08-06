import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent, type ChangeEvent, type DragEvent } from 'react'
import { type ImageAttachment } from '../types'
import ImagePreview from './ImagePreview'
import './ChatInput.css'

interface ChatInputProps {
  onSendMessage: (content: string, images?: ImageAttachment[]) => void
  onStopMessage: () => void
  disabled: boolean
  isStreaming: boolean
}

function ChatInput({ onSendMessage, onStopMessage, disabled, isStreaming }: ChatInputProps): React.ReactElement {
  const [message, setMessage] = useState('')
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([])
  const [dragActive, setDragActive] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if ((message.trim() || attachedImages.length > 0) && !disabled) {
      onSendMessage(message.trim(), attachedImages.length > 0 ? attachedImages : undefined)
      setMessage('')
      setAttachedImages([])
      // Clean up blob URLs
      // attachedImages.forEach(img => URL.revokeObjectURL(img.url))
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if ((message.trim() || attachedImages.length > 0) && !disabled) {
        onSendMessage(message.trim(), attachedImages.length > 0 ? attachedImages : undefined)
        setMessage('')
        setAttachedImages([])
        // Clean up blob URLs
        // attachedImages.forEach(img => URL.revokeObjectURL(img.url))
      }
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    setMessage(e.target.value)
  }

  const processImageFiles = useCallback((files: File[]) => {
    const maxImageSize = 10 * 1024 * 1024 // 10MB limit
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    
    files.forEach(file => {
      // Validate file type
      if (!supportedTypes.includes(file.type)) {
        console.warn(`Unsupported file type: ${file.type}`)
        return
      }
      
      // Validate file size
      if (file.size > maxImageSize) {
        console.warn(`File too large: ${file.name} (${file.size} bytes)`)
        return
      }
      
      // Create preview URL
      const url = URL.createObjectURL(file)
      
      const imageAttachment: ImageAttachment = {
        id: crypto.randomUUID(),
        file,
        url,
        media_type: file.type as ImageAttachment['media_type'],
        size: file.size,
        name: file.name
      }
      
      setAttachedImages(prev => [...prev, imageAttachment])
    })
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    
    if (disabled) return
    
    const files = Array.from(e.dataTransfer?.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length > 0) {
      processImageFiles(imageFiles)
    }
  }, [disabled, processImageFiles])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) {
      setDragActive(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      processImageFiles(files)
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }, [processImageFiles])

  const handleRemoveImage = useCallback((id: string) => {
    setAttachedImages(prev => {
      const imageToRemove = prev.find(img => img.id === id)
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url)
      }
      return prev.filter(img => img.id !== id)
    })
  }, [])

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current
      el.style.setProperty('height', 'auto')
      el.style.setProperty('height', `${el.scrollHeight}px`)
    }
  }, [message])

  return (
    <div 
      className={`input-container ${dragActive ? 'drag-active' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {attachedImages.length > 0 && (
        <div className="attached-images">
          <ImagePreview 
            images={attachedImages} 
            onRemove={handleRemoveImage}
          />
        </div>
      )}
      
      <form className="input-wrapper" onSubmit={handleSubmit}>
        <div className="input-controls">
          <button
            type="button"
            onClick={handleImageButtonClick}
            disabled={disabled}
            className="image-button"
            title="Attach image"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
          </button>
          
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
        </div>
        
        {isStreaming ? (
          <button
            type="button"
            onClick={onStopMessage}
            className="stop-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || (!message.trim() && attachedImages.length === 0)}
            className="send-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22,2 15,22 11,13 2,9"></polygon>
            </svg>
          </button>
        )}
      </form>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      {dragActive && (
        <div className="drag-overlay">
          <div className="drag-message">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
            <p>Drop images here</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatInput
