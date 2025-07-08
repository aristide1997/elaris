import { create } from 'zustand'

interface AuthField {
  name: string
  type: string
  required: boolean
  description: string
  env_var?: string
  default?: string
}

interface ProviderInfo {
  name: string
  display_name: string
  description: string
  auth_fields: AuthField[]
  supports_base_url: boolean
  default_models: string[]
}

interface CurrentProvider {
  provider: string
  model: string
  config: Record<string, any>
}

interface ModelInfo {
  id: string
  name: string
  provider: string
  context_length?: number
  pricing?: {
    prompt: string
    completion: string
  }
  description?: string
  capabilities?: string[]
}

interface LLMProviderState {
  availableProviders: Record<string, ProviderInfo>
  currentProvider: CurrentProvider | null
  availableModels: ModelInfo[]
  isLoading: boolean
  isLoadingModels: boolean
  error: string | null
  modelsError: string | null
  
  // Actions
  loadAvailableProviders: () => Promise<void>
  loadCurrentProvider: () => Promise<void>
  loadModelsForProvider: (provider: string) => Promise<void>
  testProvider: (provider: string, model: string, config: Record<string, any>) => Promise<{ success: boolean; message: string; error?: string }>
  configureProvider: (provider: string, model: string, config: Record<string, any>) => Promise<void>
  selectModel: (modelId: string) => Promise<void>
  clearError: () => void
  clearModelsError: () => void
}

export const useLLMProviderStore = create<LLMProviderState>((set, get) => ({
  availableProviders: {},
  currentProvider: null,
  availableModels: [],
  isLoading: false,
  isLoadingModels: false,
  error: null,
  modelsError: null,

  loadAvailableProviders: async () => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await fetch('/api/llm-providers/available')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to load providers')
      }
      
      if (data.success) {
        set({ 
          availableProviders: data.providers,
          isLoading: false 
        })
      } else {
        throw new Error('Failed to load providers')
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load providers',
        isLoading: false 
      })
    }
  },

  loadCurrentProvider: async () => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await fetch('/api/llm-providers/current')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to load current provider')
      }
      
      if (data.success) {
        set({ 
          currentProvider: data.current_provider,
          isLoading: false 
        })
      } else {
        throw new Error('Failed to load current provider')
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load current provider',
        isLoading: false 
      })
    }
  },

  testProvider: async (provider: string, model: string, config: Record<string, any>) => {
    try {
      const response = await fetch('/api/llm-providers/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, model, config }),
      })
      
      const data = await response.json()
      return {
        success: data.success,
        message: data.message,
        error: data.error
      }
    } catch (error) {
      return {
        success: false,
        message: 'Test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  },

  configureProvider: async (provider: string, model: string, config: Record<string, any>) => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await fetch('/api/llm-providers/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, model, config }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to configure provider')
      }
      
      if (data.success) {
        // Reload current provider after successful configuration
        await get().loadCurrentProvider()
        set({ isLoading: false })
      } else {
        throw new Error(data.message || 'Failed to configure provider')
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to configure provider',
        isLoading: false 
      })
      throw error
    }
  },

  loadModelsForProvider: async (provider: string) => {
    set({ isLoadingModels: true, modelsError: null })
    
    try {
      const response = await fetch(`/api/llm-providers/models/${provider}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to load models')
      }
      
      if (data.success) {
        set({ 
          availableModels: data.models,
          isLoadingModels: false 
        })
      } else {
        throw new Error('Failed to load models')
      }
    } catch (error) {
      set({ 
        modelsError: error instanceof Error ? error.message : 'Failed to load models',
        isLoadingModels: false 
      })
    }
  },

  selectModel: async (modelId: string) => {
    const currentProvider = get().currentProvider
    if (!currentProvider) {
      throw new Error('No provider configured')
    }

    // Update the current provider with the new model
    const updatedProvider = {
      ...currentProvider,
      model: modelId
    }

    try {
      await get().configureProvider(
        updatedProvider.provider,
        updatedProvider.model,
        updatedProvider.config
      )
    } catch (error) {
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  },

  clearModelsError: () => {
    set({ modelsError: null })
  },
}))
