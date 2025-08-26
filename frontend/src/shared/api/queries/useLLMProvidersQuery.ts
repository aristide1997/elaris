import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiBase } from '../../utils/api'

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

interface TestProviderRequest {
  provider: string
  model: string
  config: Record<string, any>
}

interface TestProviderResponse {
  success: boolean
  message: string
  error?: string
}

interface ConfigureProviderRequest {
  provider: string
  model: string
  config: Record<string, any>
}

// Query Keys
export const llmProviderKeys = {
  all: ['llm-providers'] as const,
  available: () => [...llmProviderKeys.all, 'available'] as const,
  current: () => [...llmProviderKeys.all, 'current'] as const,
  models: () => [...llmProviderKeys.all, 'models'] as const,
  modelsForProvider: (provider: string) => [...llmProviderKeys.models(), provider] as const,
}

// Fetch available providers
const fetchAvailableProviders = async (): Promise<Record<string, ProviderInfo>> => {
  const base = getApiBase()
  const response = await fetch(`${base}/api/llm-providers/available`)
  
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.detail || 'Failed to load providers')
  }
  
  const data = await response.json()
  
  if (!data.success) {
    throw new Error('Failed to load providers')
  }
  
  return data.providers
}

// Fetch current provider
const fetchCurrentProvider = async (): Promise<CurrentProvider | null> => {
  const base = getApiBase()
  const response = await fetch(`${base}/api/llm-providers/current`)
  
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.detail || 'Failed to load current provider')
  }
  
  const data = await response.json()
  
  if (!data.success) {
    throw new Error('Failed to load current provider')
  }
  
  return data.current_provider
}

// Fetch models for provider
const fetchModelsForProvider = async (provider: string): Promise<ModelInfo[]> => {
  const base = getApiBase()
  const response = await fetch(`${base}/api/llm-providers/models/${provider}`)
  
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.detail || 'Failed to load models')
  }
  
  const data = await response.json()
  
  if (!data.success) {
    throw new Error('Failed to load models')
  }
  
  return data.models
}

// Test provider configuration
const testProvider = async ({ provider, model, config }: TestProviderRequest): Promise<TestProviderResponse> => {
  const base = getApiBase()
  const response = await fetch(`${base}/api/llm-providers/test`, {
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
}

// Configure provider
const configureProvider = async ({ provider, model, config }: ConfigureProviderRequest): Promise<void> => {
  const base = getApiBase()
  const response = await fetch(`${base}/api/llm-providers/configure`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider, model, config }),
  })
  
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.detail || 'Failed to configure provider')
  }
  
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to configure provider')
  }
}

// Hooks
export const useAvailableProvidersQuery = () => {
  return useQuery({
    queryKey: llmProviderKeys.available(),
    queryFn: fetchAvailableProviders,
    staleTime: 10 * 60 * 1000, // 10 minutes (providers don't change often)
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

export const useCurrentProviderQuery = () => {
  return useQuery({
    queryKey: llmProviderKeys.current(),
    queryFn: fetchCurrentProvider,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

export const useModelsForProviderQuery = (provider: string | null) => {
  return useQuery({
    queryKey: llmProviderKeys.modelsForProvider(provider || ''),
    queryFn: () => fetchModelsForProvider(provider!),
    enabled: !!provider,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  })
}

export const useTestProviderMutation = () => {
  return useMutation({
    mutationFn: testProvider,
  })
}

export const useConfigureProviderMutation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: configureProvider,
    onSuccess: () => {
      // Invalidate current provider to refresh the UI
      queryClient.invalidateQueries({ queryKey: llmProviderKeys.current() })
    },
  })
}

export const useSelectModelMutation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (modelId: string) => {
      // Get current provider first
      const currentProvider = queryClient.getQueryData<CurrentProvider>(llmProviderKeys.current())
      if (!currentProvider) {
        throw new Error('No provider configured')
      }

      // Configure with new model
      await configureProvider({
        provider: currentProvider.provider,
        model: modelId,
        config: currentProvider.config
      })
    },
    onSuccess: () => {
      // Invalidate current provider to refresh the UI
      queryClient.invalidateQueries({ queryKey: llmProviderKeys.current() })
    },
  })
}
