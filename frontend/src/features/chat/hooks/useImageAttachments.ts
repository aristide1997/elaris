import { useState, useCallback } from 'react'
import type { ImageAttachment } from '../types'

interface UseImageAttachmentsReturn {
  attachedImages: ImageAttachment[]
  addImages: (files: File[]) => void
  removeImage: (id: string) => void
  clearAttachments: () => void
  processImageFiles: (files: File[]) => void
  error: string | null
  clearError: () => void
}

export const useImageAttachments = (): UseImageAttachmentsReturn => {
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([])
  const [error, setError] = useState<string | null>(null)

  const processImageFiles = useCallback((files: File[]) => {
    const maxImageSize = 10 * 1024 * 1024 // 10MB limit
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    
    const validFiles: File[] = []
    
    files.forEach(file => {
      // Validate file type
      if (!supportedTypes.includes(file.type)) {
        setError(`Unsupported file type: ${file.type}`)
        return
      }
      
      // Validate file size
      if (file.size > maxImageSize) {
        setError(`File too large: ${file.name} (max 10MB)`)
        return
      }
      
      validFiles.push(file)
    })
    
    // Process valid files
    validFiles.forEach(file => {
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

  const addImages = useCallback((files: File[]) => {
    setError(null)
    processImageFiles(files)
  }, [processImageFiles])

  const removeImage = useCallback((id: string) => {
    setAttachedImages(prev => {
      const imageToRemove = prev.find(img => img.id === id)
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url)
      }
      return prev.filter(img => img.id !== id)
    })
  }, [])

  const clearAttachments = useCallback(() => {
    // Clean up blob URLs
    attachedImages.forEach(img => URL.revokeObjectURL(img.url))
    setAttachedImages([])
    setError(null)
  }, [attachedImages])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    attachedImages,
    addImages,
    removeImage,
    clearAttachments,
    processImageFiles,
    error,
    clearError
  }
}
