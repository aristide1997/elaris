import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface Settings {
  system_prompt: string
  llm_provider: {
    provider: string
    model: string
    config: Record<string, any>
  }
  approval_timeout: number
  mcp_servers: Record<string, any>
}

interface SettingsState {
  settings: Settings | null
  isLoading: boolean
  error: string | null
  validationErrors: string[]
  isDirty: boolean
}

interface SettingsActions {
  loadSettings: () => Promise<void>
  saveSettings: (settings: Settings) => Promise<void>
  validateMcpServers: (mcpServers: Record<string, any>) => Promise<boolean>
  updateSettings: (settings: Partial<Settings>) => void
  resetSettings: () => void
  clearError: () => void
}

type SettingsStore = SettingsState & SettingsActions

const initialState: SettingsState = {
  settings: null,
  isLoading: false,
  error: null,
  validationErrors: [],
  isDirty: false
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      loadSettings: async () => {
        set({ isLoading: true, error: null }, false, 'loadSettings/start')
        
        try {
          const response = await fetch('/api/settings')
          const data = await response.json()
          
          if (data.status === 'success') {
            set({ 
              settings: data.settings, 
              isLoading: false,
              isDirty: false 
            }, false, 'loadSettings/success')
          } else {
            set({ 
              error: data.message || 'Failed to load settings',
              isLoading: false 
            }, false, 'loadSettings/error')
          }
        } catch (error) {
          set({ 
            error: `Failed to load settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isLoading: false 
          }, false, 'loadSettings/error')
        }
      },

      saveSettings: async (settings: Settings) => {
        set({ isLoading: true, error: null, validationErrors: [] }, false, 'saveSettings/start')
        
        try {
          const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings)
          })
          
          const data = await response.json()
          
          if (data.status === 'success') {
            set({ 
              settings: settings, 
              isLoading: false,
              isDirty: false,
              validationErrors: [],
              error: null
            }, false, 'saveSettings/success')
          } else {
            // Handle both validation errors and general errors from backend
            set({ 
              validationErrors: data.errors || [],
              error: data.message || 'Failed to save settings',
              isLoading: false 
            }, false, 'saveSettings/error')
          }
        } catch (error) {
          set({ 
            error: `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
            validationErrors: [],
            isLoading: false 
          }, false, 'saveSettings/error')
        }
      },

      validateMcpServers: async (mcpServers: Record<string, any>) => {
        try {
          const response = await fetch('/api/settings/validate-mcp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(mcpServers)
          })
          
          const data = await response.json()
          
          if (data.status === 'success') {
            if (!data.valid && data.errors) {
              set({ validationErrors: data.errors }, false, 'validateMcpServers/invalid')
            } else {
              set({ validationErrors: [] }, false, 'validateMcpServers/valid')
            }
            return data.valid
          } else {
            set({ 
              error: 'Failed to validate MCP servers',
              validationErrors: []
            }, false, 'validateMcpServers/error')
            return false
          }
        } catch (error) {
          set({ 
            error: `Failed to validate MCP servers: ${error instanceof Error ? error.message : 'Unknown error'}`,
            validationErrors: []
          }, false, 'validateMcpServers/error')
          return false
        }
      },

      updateSettings: (newSettings: Partial<Settings>) => {
        const currentSettings = get().settings
        if (currentSettings) {
          const updatedSettings = { ...currentSettings, ...newSettings }
          set({ 
            settings: updatedSettings,
            isDirty: true,
            validationErrors: []
          }, false, 'updateSettings')
        }
      },

      resetSettings: () => {
        set({ 
          isDirty: false,
          validationErrors: [],
          error: null 
        }, false, 'resetSettings')
      },

      clearError: () => {
        set({ error: null, validationErrors: [] }, false, 'clearError')
      }
    }),
    {
      name: 'settings-store'
    }
  )
)
