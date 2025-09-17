import { useCurrentProviderQuery, useModelsForProviderQuery } from '../../../shared/api/queries'
import { useDropdown } from '../../../shared/hooks/useDropdown'
import { useModelSelection } from '../hooks/useModelSelection'
import './ModelPicker.css'

interface ModelPickerProps {
  className?: string
}

const ModelPicker: React.FC<ModelPickerProps> = ({ className = '' }) => {
  // Use React Query for provider data
  const { data: currentProvider } = useCurrentProviderQuery()
  const { 
    data: availableModels = [], 
    isLoading: isLoadingModels, 
    error: modelsError 
  } = useModelsForProviderQuery(currentProvider?.provider || null)

  // Use custom hooks for separated concerns
  const { isOpen, dropdownRef, toggleDropdown, closeDropdown } = useDropdown()
  
  const {
    customModel,
    setCustomModel,
    showCustomInput,
    isSelectingModel,
    error: selectionError,
    handleModelSelect,
    handleCustomModelSubmit,
    handleCustomModelKeyDown,
    cancelCustomModel
  } = useModelSelection(() => {
    closeDropdown()
  })

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
      <div className="model-picker-trigger" onClick={toggleDropdown}>
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
            {(isLoadingModels || isSelectingModel) && <span className="loading-text">Loading...</span>}
          </div>

          {(modelsError || selectionError) && (
            <div className="dropdown-error">
              <span>{modelsError?.message || selectionError}</span>
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
                  onClick={cancelCustomModel}
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
