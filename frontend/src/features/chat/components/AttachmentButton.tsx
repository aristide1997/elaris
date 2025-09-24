import { useRef, useCallback, type ChangeEvent } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { PlusIcon, ImageIcon } from '@radix-ui/react-icons'
import './AttachmentButton.css'

interface AttachmentButtonProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
  className?: string
}

const AttachmentButton: React.FC<AttachmentButtonProps> = ({ 
  onFilesSelected, 
  disabled = false, 
  className = '' 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      onFilesSelected(files)
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }, [onFilesSelected])

  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className={`attachment-button-container ${className}`}>
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
          <DropdownMenu.Content className="attachment-dropdown-content" sideOffset={8}>
            <DropdownMenu.Item 
              className="attachment-dropdown-item"
              onSelect={handleImageButtonClick}
            >
              <ImageIcon width={16} height={16} />
              <span>Attach Images</span>
            </DropdownMenu.Item>
            <DropdownMenu.Arrow className="attachment-dropdown-arrow" />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default AttachmentButton
