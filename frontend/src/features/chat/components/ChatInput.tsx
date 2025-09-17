import { useRef, useCallback, type ChangeEvent } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { PlusIcon, ImageIcon } from '@radix-ui/react-icons'
import { type ImageAttachment } from '../types'
import { useImageAttachments } from '../hooks/useImageAttachments'
import { useDragAndDrop } from '../hooks/useDragAndDrop'
import { useFormInput } from '../hooks/useFormInput'
import ImagePreview from './ImagePreview'
import './ChatInput.css'

interface ChatInputProps {
  onSendMessage: (content: string, images?: ImageAttachment[]) => void
  onStopMessage: () => void
  disabled: boolean
  isStreaming: boolean
}

function ChatInput({ onSendMessage, onStopMessage, disabled, isStreaming }: ChatInputProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use custom hooks for separated concerns
  const { 
    attachedImages, 
    addImages, 
    removeImage, 
    clearAttachments,
    error: attachmentError
  } = useImageAttachments()

  const { dragActive, handleDrop, handleDragOver, handleDragLeave } = useDragAndDrop(addImages, disabled)

  const { 
    message, 
    textareaRef, 
    handleSubmit, 
    handleKeyDown, 
    handleChange 
  } = useFormInput(
    (content: string, images?: ImageAttachment[]) => {
      onSendMessage(content, images)
      clearAttachments()
    },
    attachedImages,
    disabled
  )

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      addImages(files)
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }, [addImages])

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

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
            onRemove={removeImage}
          />
        </div>
      )}
      
      <form className="input-wrapper" onSubmit={handleSubmit}>
        <div className="input-with-attachments">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                disabled={disabled}
                className="attachment-button"
                title="Add attachments"
              >
                <PlusIcon width={16} height={16} />
              </button>
            </DropdownMenu.Trigger>
            
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="dropdown-content" sideOffset={8}>
                <DropdownMenu.Item 
                  className="dropdown-item"
                  onSelect={handleImageButtonClick}
                >
                  <ImageIcon width={16} height={16} />
                  <span>Attach Images</span>
                </DropdownMenu.Item>
                <DropdownMenu.Arrow className="dropdown-arrow" />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          
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
