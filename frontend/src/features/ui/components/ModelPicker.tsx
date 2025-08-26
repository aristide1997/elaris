import { useState, useEffect, useRef } from 'react'
import { useLLMProviderStore } from '../stores/useLLMProviderStore'
import { useConnectionStore } from '../../connection'
import './ModelPicker.css'

interface ModelPickerProps {
  className?: string
}

const ModelPicker: React.FC<ModelPickerProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [customModel, setCustomModel] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const {
    currentProvider,
    availableModels,
    isLoadingModels,
    modelsError,
    loadCurrentProvider,
    loadModelsForProvider,
    selectModel,
    clearModelsError
  } = useLLMProviderStore()

  const isConnected = useConnectionStore(state => state.isConnected)

  // Load current provider when connected
  useEffect(() => {
    if (isConnected) {
      loadCurrentProvider()
    }
  }, [isConnected, loadCurrentProvider])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowCustomInput(false)
        setCustomModel('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load models when provider changes (regardless of dropdown state)
  useEffect(() => {
    if (currentProvider?.provider) {
      loadModelsForProvider(currentProvider.provider)
    }
  }, [currentProvider?.provider, loadModelsForProvider])

  // Also load models when dropdown opens (in case they weren't loaded yet)
  useEffect(() => {
    if (currentProvider?.provider && isOpen && availableModels.length === 0 && !isLoadingModels) {
      loadModelsForProvider(currentProvider.provider)
    }
  }, [currentProvider?.provider, isOpen, availableModels.length, isLoadingModels, loadModelsForProvider])

  const handleToggleDropdown = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      clearModelsError()
    }
  }

  const handleModelSelect = async (modelId: string) => {
    if (modelId === 'custom') {
      setShowCustomInput(true)
      return
    }

    try {
      await selectModel(modelId)
      setIsOpen(false)
      setShowCustomInput(false)
      setCustomModel('')
    } catch (error) {
      console.error('Failed to select model:', error)
    }
  }

  const handleCustomModelSubmit = async () => {
    if (!customModel.trim()) return

    try {
      await selectModel(customModel)
      setIsOpen(false)
      setShowCustomInput(false)
      setCustomModel('')
    } catch (error) {
      console.error('Failed to select custom model:', error)
    }
  }

  const handleCustomModelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomModelSubmit()
    } else if (e.key === 'Escape') {
      setShowCustomInput(false)
      setCustomModel('')
    }
  }

  const getDisplayName = (model: string) => {
    const modelInfo = availableModels.find(m => m.id === model)
    return modelInfo?.name || model
  }

  const truncateModelName = (name: string, maxLength: number = 25) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name
  }

  if (!currentProvider) {
    return (
      <div className={`model-picker ${className}`}>
        <div className="model-picker-trigger disabled">
          <span>No Provider</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`model-picker ${className}`} ref={dropdownRef}>
      <div className="model-picker-trigger" onClick={handleToggleDropdown}>
        <span className="model-name">
          {truncateModelName(getDisplayName(currentProvider.model))}
        </span>
        <svg 
          className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill="none"
        >
          <path 
            d="M3 4.5L6 7.5L9 4.5" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {isOpen && (
        <div className="model-picker-dropdown">
          <div className="dropdown-header">
            <span>Select Model</span>
            {isLoadingModels && <span className="loading-text">Loading...</span>}
          </div>

          {modelsError && (
            <div className="dropdown-error">
              <span>{modelsError}</span>
            </div>
          )}

          {showCustomInput ? (
            <div className="custom-model-input">
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                onKeyDown={handleCustomModelKeyDown}
                placeholder="Enter custom model name..."
                autoFocus
              />
              <div className="custom-model-actions">
                <button 
                  onClick={handleCustomModelSubmit}
                  disabled={!customModel.trim()}
                  className="btn-primary"
                >
                  Select
                </button>
                <button 
                  onClick={() => {
                    setShowCustomInput(false)
                    setCustomModel('')
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="dropdown-options">
                {availableModels.length > 0 ? (
                  availableModels.map((model) => (
                    <div
                      key={model.id}
                      className={`dropdown-option ${model.id === currentProvider.model ? 'selected' : ''}`}
                      onClick={() => handleModelSelect(model.id)}
                    >
                      <div className="model-info">
                        <span className="model-name">{model.name}</span>
                        <span className="model-id">{model.id}</span>
                      </div>
                      {model.context_length && (
                        <span className="model-context">
                          {model.context_length.toLocaleString()} ctx
                        </span>
                      )}
                    </div>
                  ))
                ) : !isLoadingModels && !modelsError ? (
                  <div className="dropdown-option disabled">
                    <span>No models available</span>
                  </div>
                ) : null}
              </div>

              <div className="dropdown-footer">
                <button
                  onClick={() => handleModelSelect('custom')}
                  className="custom-model-button"
                >
                  <span>Custom model...</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ModelPicker
