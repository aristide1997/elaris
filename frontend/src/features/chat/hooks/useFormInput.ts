import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react'
import type { ImageAttachment } from '../types'

interface UseFormInputReturn {
  message: string
  setMessage: (message: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  handleChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  clearMessage: () => void
}

export const useFormInput = (
  onSendMessage: (content: string, images?: ImageAttachment[]) => void,
  attachedImages: ImageAttachment[],
  disabled: boolean
): UseFormInputReturn => {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const clearMessage = useCallback(() => {
    setMessage('')
  }, [])

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if ((message.trim() || attachedImages.length > 0) && !disabled) {
      onSendMessage(message.trim(), attachedImages.length > 0 ? attachedImages : undefined)
      clearMessage()
    }
  }, [message, attachedImages, disabled, onSendMessage, clearMessage])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if ((message.trim() || attachedImages.length > 0) && !disabled) {
        onSendMessage(message.trim(), attachedImages.length > 0 ? attachedImages : undefined)
        clearMessage()
      }
    }
  }, [message, attachedImages, disabled, onSendMessage, clearMessage])

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const el = textareaRef.current
      el.style.setProperty('height', 'auto')
      el.style.setProperty('height', `${el.scrollHeight}px`)
    }
  }, [message])

  return {
    message,
    setMessage,
    textareaRef,
    handleSubmit,
    handleKeyDown,
    handleChange,
    clearMessage
  }
}
