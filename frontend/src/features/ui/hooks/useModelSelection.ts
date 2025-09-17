import { useState, useCallback } from 'react'
import { useSelectModelMutation } from '../../../shared/api/queries'

interface UseModelSelectionReturn {
  customModel: string
  setCustomModel: (model: string) => void
  showCustomInput: boolean
  setShowCustomInput: (show: boolean) => void
  isSelectingModel: boolean
  error: string | null
  handleModelSelect: (modelId: string) => Promise<void>
  handleCustomModelSubmit: () => Promise<void>
  handleCustomModelKeyDown: (e: React.KeyboardEvent) => void
  cancelCustomModel: () => void
}

export const useModelSelection = (onSuccess?: () => void): UseModelSelectionReturn => {
  const [customModel, setCustomModel] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const selectModelMutation = useSelectModelMutation()

  const resetCustomModel = useCallback(() => {
    setShowCustomInput(false)
    setCustomModel('')
    setError(null)
  }, [])

  const handleModelSelect = useCallback(async (modelId: string) => {
    if (modelId === 'custom') {
      setShowCustomInput(true)
      return
    }

    try {
      setError(null)
      await selectModelMutation.mutateAsync(modelId)
      onSuccess?.()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to select model')
      console.error('Failed to select model:', error)
    }
  }, [selectModelMutation, onSuccess])

  const handleCustomModelSubmit = useCallback(async () => {
    if (!customModel.trim()) {
      setError('Model name cannot be empty')
      return
    }

    try {
      setError(null)
      await selectModelMutation.mutateAsync(customModel.trim())
      resetCustomModel()
      onSuccess?.()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to select custom model')
      console.error('Failed to select custom model:', error)
    }
  }, [customModel, selectModelMutation, resetCustomModel, onSuccess])

  const handleCustomModelKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCustomModelSubmit()
    } else if (e.key === 'Escape') {
      resetCustomModel()
    }
  }, [handleCustomModelSubmit, resetCustomModel])

  const cancelCustomModel = useCallback(() => {
    resetCustomModel()
  }, [resetCustomModel])

  return {
    customModel,
    setCustomModel,
    showCustomInput,
    setShowCustomInput,
    isSelectingModel: selectModelMutation.isPending,
    error,
    handleModelSelect,
    handleCustomModelSubmit,
    handleCustomModelKeyDown,
    cancelCustomModel
  }
}
