import * as Select from "@radix-ui/react-select"
import { useCurrentProviderQuery, useModelsForProviderQuery, useSelectModelMutation } from '../../../shared/api/queries'
import { useUIStore } from '../stores/useUIStore'
import './ModelPicker.css'

interface ModelPickerProps {
  className?: string
}

const ModelPicker: React.FC<ModelPickerProps> = ({ className = '' }) => {
  const { data: currentProvider } = useCurrentProviderQuery()
  const { 
    data: availableModels = [], 
    isLoading: isLoadingModels, 
    error: modelsError 
  } = useModelsForProviderQuery(currentProvider?.provider || null)
  
  const selectModelMutation = useSelectModelMutation()
  const { openSettings } = useUIStore()

  const getDisplayName = (model: string) => {
    const modelInfo = availableModels.find(m => m.id === model)
    return modelInfo?.name || model
  }

  const truncateModelName = (name: string, maxLength: number = 25) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name
  }

  const handleModelChange = async (value: string) => {
    if (value === 'custom') {
      openSettings()
      return
    }
    
    try {
      await selectModelMutation.mutateAsync(value)
    } catch (error) {
      console.error('Failed to select model:', error)
    }
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
    <div className={`model-picker ${className}`}>
      <Select.Root value={currentProvider.model} onValueChange={handleModelChange}>
        <Select.Trigger className="model-picker-trigger">
          <Select.Value>
            <span className="model-name">
              {truncateModelName(getDisplayName(currentProvider.model))}
            </span>
          </Select.Value>
          <Select.Icon>
            <svg 
              className="dropdown-arrow"
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
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content className="model-picker-dropdown">
            {isLoadingModels && (
              <div className="dropdown-header">
                <span className="loading-text">Loading...</span>
              </div>
            )}

            {modelsError && (
              <div className="dropdown-error">
                <span>{modelsError.message}</span>
              </div>
            )}

            <Select.Viewport>
              {!isLoadingModels && !modelsError && availableModels.length > 0 && (
                <>
                  {availableModels.map((model) => (
                    <Select.Item key={model.id} value={model.id} className="dropdown-option">
                      <div className="model-info">
                        <Select.ItemText>
                          <span className="model-name">{model.name}</span>
                        </Select.ItemText>
                        <span className="model-id">{model.id}</span>
                      </div>
                      {model.context_length && (
                        <span className="model-context">
                          {model.context_length.toLocaleString()} ctx
                        </span>
                      )}
                      <Select.ItemIndicator className="select-item-indicator">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path 
                            d="M10 3L4.5 8.5L2 6" 
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                        </svg>
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                  
                  <Select.Separator className="dropdown-separator" />
                  
                  <Select.Item value="custom" className="custom-model-button">
                    <Select.ItemText>Custom model...</Select.ItemText>
                  </Select.Item>
                </>
              )}

              {!isLoadingModels && !modelsError && availableModels.length === 0 && (
                <Select.Item value="" disabled className="dropdown-option disabled">
                  <Select.ItemText>No models available</Select.ItemText>
                </Select.Item>
              )}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}

export default ModelPicker
