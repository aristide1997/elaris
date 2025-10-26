import { type ImageAttachment } from '../types'
import { useImageAttachments } from '../hooks/useImageAttachments'
import { useDragAndDrop } from '../hooks/useDragAndDrop'
import { useFormInput } from '../hooks/useFormInput'
import { MCPServerDropdown } from '../../connection'
import ModelPicker from '../../ui/components/ModelPicker'
import ImagePreview from './ImagePreview'
import AttachmentButton from './AttachmentButton'
import './ChatInput.css'

interface ChatInputProps {
  onSendMessage: (content: string, images?: ImageAttachment[]) => void
  onStopMessage: () => void
  disabled: boolean
  isStreaming: boolean
}

function ChatInput({ onSendMessage, onStopMessage, disabled, isStreaming }: ChatInputProps): React.ReactElement {
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
        <div className="input-box">
          <div className="input-row">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="How can I help?"
              rows={1}
              disabled={disabled}
              className="message-input"
            />
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
          </div>
          <div className="controls-row">
            <div className="controls-left">
              <AttachmentButton 
                onFilesSelected={addImages}
                disabled={disabled}
              />
            </div>
            <div className="controls-right">
              <MCPServerDropdown />
              <ModelPicker />
            </div>
          </div>
        </div>
      </form>
      
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
