import { useState, useCallback, type DragEvent } from 'react'

interface UseDragAndDropReturn {
  dragActive: boolean
  handleDrop: (e: DragEvent<HTMLDivElement>) => void
  handleDragOver: (e: DragEvent<HTMLDivElement>) => void
  handleDragLeave: (e: DragEvent<HTMLDivElement>) => void
}

export const useDragAndDrop = (
  onDrop: (files: File[]) => void,
  disabled: boolean = false
): UseDragAndDropReturn => {
  const [dragActive, setDragActive] = useState(false)

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    
    if (disabled) return
    
    const files = Array.from(e.dataTransfer?.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length > 0) {
      onDrop(imageFiles)
    }
  }, [disabled, onDrop])

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

  return {
    dragActive,
    handleDrop,
    handleDragOver,
    handleDragLeave
  }
}
