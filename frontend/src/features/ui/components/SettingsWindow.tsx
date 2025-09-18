import { useState, useEffect } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useConnectionStore } from '../../connection/stores/useConnectionStore'
import { 
  useAvailableProvidersQuery, 
  useCurrentProviderQuery, 
  useModelsForProviderQuery,
  useTestProviderMutation,
  useConfigureProviderMutation
} from '../../../shared/api/queries'
import { useWebSocketConnection } from '../../connection'
import './SettingsWindow.css'

type TabType = 'general' | 'llm' | 'mcp'

const SettingsWindow: React.FC = () => {
  // Initialize WebSocket connection for this window
  useWebSocketConnection()

  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [mcpJsonText, setMcpJsonText] = useState('')
  const [mcpJsonError, setMcpJsonError] = useState<string | null>(null)
  const [mcpJsonTouched, setMcpJsonTouched] = useState(false)

  // LLM Provider state
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [providerConfig, setProviderConfig] = useState<Record<string, any>>({})
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; error?: string } | null>(null)
  const [isTestingProvider, setIsTestingProvider] = useState(false)
  const [customModelName, setCustomModelName] = useState('')

  const {
    settings,
    isLoading,
    error,
    validationErrors,
    isDirty,
    loadSettings,
    saveSettings,
    updateSettings,
    resetSettings,
    clearError
  } = useSettingsStore()

  const sendMessage = useConnectionStore(state => state.sendMessage)

  // React Query hooks for LLM providers
  const { data: availableProviders = {}, isLoading: isProviderLoading, error: providerError } = useAvailableProvidersQuery()
  const { data: currentProvider } = useCurrentProviderQuery()
  const { data: availableModels = [], isLoading: isLoadingModels, error: modelsError } = useModelsForProviderQuery(selectedProvider || null)
  const testProviderMutation = useTestProviderMutation()
  const configureProviderMutation = useConfigureProviderMutation()

  // Load settings when window opens
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Initialize LLM form state when current provider loads
  useEffect(() => {
    if (currentProvider) {
      setSelectedProvider(currentProvider.provider)
      setSelectedModel(currentProvider.model)
      setProviderConfig(currentProvider.config)
    }
  }, [currentProvider])

  // Helper function to update LLM provider in main settings
  const updateLLMProviderSettings = (provider: string, model: string, config: Record<string, any>) => {
    updateSettings({
      llm_provider: {
        provider,
        model,
        config
      }
    })
  }

  // Update MCP JSON text when settings change
  useEffect(() => {
    if (settings?.mcp_servers) {
      setMcpJsonText(JSON.stringify(settings.mcp_servers, null, 2))
      setMcpJsonError(null)
    }
  }, [settings?.mcp_servers])

  const handleClose = async () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        resetSettings()
        if (window.electronAPI?.closeSettings) {
          await window.electronAPI.closeSettings()
        }
      }
    } else {
      if (window.electronAPI?.closeSettings) {
        await window.electronAPI.closeSettings()
      }
    }
  }

  const handleSave = async () => {
    if (!settings) return

    let updatedSettings = settings

    // If on MCP tab, validate and parse JSON first
    if (activeTab === 'mcp') {
      try {
        const mcpServers = JSON.parse(mcpJsonText)
        updatedSettings = { ...settings, mcp_servers: mcpServers }
        await saveSettings(updatedSettings)
      } catch (e) {
        setMcpJsonError('Invalid JSON format')
        return
      }
    } else {
      await saveSettings(updatedSettings)
    }

    if (!error && validationErrors.length === 0) {
      sendMessage({ type: 'update_settings', settings: updatedSettings })
      
      // Notify main window of settings update
      if (window.electronAPI?.settingsUpdated) {
        await window.electronAPI.settingsUpdated(updatedSettings)
      }
      
      if (window.electronAPI?.closeSettings) {
        await window.electronAPI.closeSettings()
      }
    }
  }

  const handleCancel = async () => {
    resetSettings()
    if (window.electronAPI?.closeSettings) {
      await window.electronAPI.closeSettings()
    }
  }

  const handleSystemPromptChange = (value: string) => {
    updateSettings({ system_prompt: value })
  }

  const handleApprovalTimeoutChange = (value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue > 0) {
      updateSettings({ approval_timeout: numValue })
    }
  }


  const handleAutoApproveToolsChange = (checked: boolean) => {
    updateSettings({ auto_approve_tools: checked })
  }

  const handleEnableThinkingChange = (checked: boolean) => {
    updateSettings({ enable_thinking: checked })
  }

  const handleMcpJsonChange = (value: string) => {
    setMcpJsonTouched(true)
    setMcpJsonText(value)
    setMcpJsonError(null)
    
    // Try to parse and update settings
    try {
      const parsed = JSON.parse(value)
      updateSettings({ mcp_servers: parsed })
    } catch (e) {
      // Don't update settings if JSON is invalid, just show error
      setMcpJsonError('Invalid JSON format')
    }
  }

  const formatMcpJson = () => {
    setMcpJsonTouched(true)
    try {
      const parsed = JSON.parse(mcpJsonText)
      setMcpJsonText(JSON.stringify(parsed, null, 2))
      setMcpJsonError(null)
    } catch (e) {
      setMcpJsonError('Cannot format invalid JSON')
    }
  }

  const getStatusText = () => {
    if (isLoading) return 'Saving...'
    if (isDirty) return 'Unsaved changes'
    return 'All changes saved'
  }

  const getStatusClass = () => {
    if (isLoading) return 'saving'
    if (isDirty) return 'dirty' 
    return 'saved'
  }

  if (!settings) {
    return (
      <div className="settings-window">
        <div className="settings-window-header">
          <h2 className="settings-window-title">Settings</h2>
        </div>
        <div className="settings-window-content">
          <div className="settings-tab-content">
            <div>Loading settings...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-window">
      <div className="settings-window-header">
        <h2 className="settings-window-title">Settings</h2>
      </div>

      <div className="settings-window-content">
          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
            <button
              className={`settings-tab ${activeTab === 'llm' ? 'active' : ''}`}
              onClick={() => setActiveTab('llm')}
            >
              LLM Provider
            </button>
            <button
              className={`settings-tab ${activeTab === 'mcp' ? 'active' : ''}`}
              onClick={() => setActiveTab('mcp')}
            >
              MCP Servers
            </button>
          </div>

          <div className="settings-tab-content">
            {(error || validationErrors.length > 0) && (
              <div className="settings-errors">
                {error && <div>{error}</div>}
                {validationErrors.length > 0 && (
                  <ul>
                    {validationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'general' && (
              <div>
                <div className="settings-form-group">
                  <label>Updates</label>
                  <button
                    type="button"
                    className="settings-btn secondary"
                    onClick={async () => {
                      console.log('Manual update check requested from settings')
                      await window.electronAPI?.checkForUpdates()
                    }}
                  >
                    Check for Updates
                  </button>
                  <div className="form-description">
                    Check for application updates and download them if available.
                  </div>
                </div>

                <div className="settings-form-group">
                  <label htmlFor="system-prompt">System Prompt</label>
                  <textarea
                    id="system-prompt"
                    value={settings.system_prompt}
                    onChange={(e) => handleSystemPromptChange(e.target.value)}
                    placeholder="Enter the system prompt for the AI assistant..."
                  />
                  <div className="form-description">
                    This prompt will be used to set the AI's behavior and personality.
                  </div>
                </div>

                <div className="settings-form-group">
                  <label htmlFor="approval-timeout">Approval Timeout (seconds)</label>
                  <input
                    id="approval-timeout"
                    type="number"
                    min="1"
                    step="1"
                    value={settings.approval_timeout}
                    onChange={(e) => handleApprovalTimeoutChange(e.target.value)}
                  />
                  <div className="form-description">
                    How long to wait for tool approval before timing out.
                  </div>
                </div>

                <div className="settings-form-group">
                  <label htmlFor="auto-approve-tools">
                    <input
                      id="auto-approve-tools"
                      type="checkbox"
                      checked={settings.auto_approve_tools}
                      onChange={(e) => handleAutoApproveToolsChange(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    Auto-approve tool calls
                  </label>
                  <div className="form-description">
                    Automatically approve all tool execution requests without showing approval dialogs. 
                    <strong style={{ color: '#dc3545' }}> Warning:</strong> This will execute all tool requests without user confirmation.
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'llm' && (
              <div>
                {providerError && (
                  <div className="settings-errors">
                    <div>{providerError.message}</div>
                  </div>
                )}

                {isProviderLoading ? (
                  <div>Loading LLM providers...</div>
                ) : (
                  <>
                    <div className="settings-form-group">
                      <label htmlFor="llm-provider-select">LLM Provider</label>
                      <select
                        id="llm-provider-select"
                        value={selectedProvider}
                        onChange={(e) => {
                          setSelectedProvider(e.target.value)
                          setSelectedModel('')
                          setProviderConfig({})
                          setTestResult(null)
                          updateLLMProviderSettings(e.target.value, '', {})
                        }}
                      >
                        <option value="">Select a provider...</option>
                        {Object.values(availableProviders).map(provider => (
                          <option key={provider.name} value={provider.name}>
                            {provider.display_name}
                          </option>
                        ))}
                      </select>
                      {selectedProvider && availableProviders[selectedProvider] && (
                        <div className="form-description">
                          {availableProviders[selectedProvider].description}
                        </div>
                      )}
                    </div>

                    {selectedProvider && availableProviders[selectedProvider] && (
                      <>
                        <div className="settings-form-group">
                          <label htmlFor="llm-model-select">Model</label>
                          {isLoadingModels ? (
                            <div className="loading-indicator">Loading models...</div>
                          ) : (
                            <>
                              <select
                                id="llm-model-select"
                                value={selectedModel}
                                onChange={(e) => {
                                  const value = e.target.value
                                  setTestResult(null)
                                  if (value === 'custom') {
                                    setSelectedModel('custom')
                                    setCustomModelName('')
                                    updateLLMProviderSettings(selectedProvider, '', providerConfig)
                                  } else {
                                    setSelectedModel(value)
                                    setCustomModelName('')
                                    updateLLMProviderSettings(selectedProvider, value, providerConfig)
                                  }
                                }}
                              >
                                <option value="">Select a model...</option>
                                {availableModels.map(model => (
                                  <option key={model.id} value={model.id}>
                                    {model.name} ({model.id})
                                  </option>
                                ))}
                                <option value="custom">Custom model...</option>
                              </select>
                              
                              {selectedModel === 'custom' && (
                                <input
                                  type="text"
                                  placeholder="Enter custom model name..."
                                  style={{ marginTop: '8px' }}
                                  value={customModelName}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setCustomModelName(value)
                                    setTestResult(null)
                                    updateLLMProviderSettings(selectedProvider, value, providerConfig)
                                  }}
                                />
                              )}
                            </>
                          )}
                          
                          {modelsError && (
                            <div className="form-description" style={{ color: '#dc3545', marginTop: '8px' }}>
                              {modelsError.message}
                            </div>
                          )}
                          
                          {selectedModel && selectedModel !== 'custom' && availableModels.length > 0 && (
                            (() => {
                              const modelInfo = availableModels.find(m => m.id === selectedModel)
                              return modelInfo ? (
                                <div className="form-description" style={{ marginTop: '8px' }}>
                                  <strong>{modelInfo.name}</strong>
                                  {modelInfo.context_length && (
                                    <span> • Context: {modelInfo.context_length.toLocaleString()} tokens</span>
                                  )}
                                  {modelInfo.description && (
                                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
                                      {modelInfo.description}
                                    </div>
                                  )}
                                </div>
                              ) : null
                            })()
                          )}
                          
                          <div className="form-description">
                            Select a model from the available options or choose "Custom model..." to enter a custom model name.
                            Models are loaded from OpenRouter's comprehensive catalog.
                          </div>
                        </div>

                        <div className="settings-form-group">
                          <label htmlFor="enable-thinking">
                            <input
                              id="enable-thinking"
                              type="checkbox"
                              checked={settings.enable_thinking}
                              onChange={(e) => handleEnableThinkingChange(e.target.checked)}
                              style={{ marginRight: '8px' }}
                            />
                            Enable Thinking
                          </label>
                          <div className="form-description">
                            Allow models to use thinking/reasoning capabilities when available. When enabled, compatible models can show their internal reasoning process.
                          </div>
                        </div>

                        {availableProviders[selectedProvider].auth_fields.map(field => (
                          <div key={field.name} className="settings-form-group">
                            <label htmlFor={`llm-${field.name}`}>
                              {field.name.charAt(0).toUpperCase() + field.name.slice(1).replace('_', ' ')}
                              {field.required && <span style={{ color: '#dc3545' }}> *</span>}
                            </label>
                            <input
                              id={`llm-${field.name}`}
                              type={field.type === 'password' ? 'password' : 'text'}
                              value={providerConfig[field.name] || ''}
                              onChange={(e) => {
                                const newConfig = {
                                  ...providerConfig,
                                  [field.name]: e.target.value
                                }
                                setProviderConfig(newConfig)
                                setTestResult(null)
                                updateLLMProviderSettings(selectedProvider, selectedModel, newConfig)
                              }}
                              placeholder={field.description}
                              required={field.required}
                            />
                            <div className="form-description">
                              {field.description}
                            </div>
                          </div>
                        ))}

                        {selectedProvider && selectedModel && (
                          <div className="settings-form-group">
                            <button
                              type="button"
                              className="settings-btn secondary"
                              onClick={async () => {
                                setIsTestingProvider(true)
                                setTestResult(null)
                                try {
                                  const result = await testProviderMutation.mutateAsync({ provider: selectedProvider, model: selectedModel, config: providerConfig })
                                  setTestResult(result)
                                } finally {
                                  setIsTestingProvider(false)
                                }
                              }}
                              disabled={isTestingProvider}
                            >
                              {isTestingProvider ? 'Testing...' : 'Test Connection'}
                            </button>

                            {testResult && (
                              <div 
                                className="form-description" 
                                style={{ 
                                  color: testResult.success ? '#28a745' : '#dc3545',
                                  marginTop: '8px'
                                }}
                              >
                                {testResult.message}
                                {testResult.error && ` - ${testResult.error}`}
                              </div>
                            )}
                          </div>
                        )}

                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'mcp' && (
              <div>
                <div className="settings-form-group">
                  <label htmlFor="mcp-servers">MCP Servers Configuration</label>
                  <textarea
                    id="mcp-servers"
                    className="json-editor"
                    value={mcpJsonText}
                    onChange={(e) => handleMcpJsonChange(e.target.value)}
                    placeholder='{\n  "server-name": {\n    "command": "command",\n    "args": ["arg1", "arg2"]\n  }\n}'
                  />
                  <button
                    type="button"
                    className="json-format-btn"
                    onClick={formatMcpJson}
                  >
                    Format JSON
                  </button>
                  {mcpJsonError && (
                    <div className="form-description" style={{ color: '#dc3545', marginTop: '8px' }}>
                      {mcpJsonError}
                    </div>
                  )}
                  {mcpJsonTouched && !mcpJsonError && (
                    <div className="form-description" style={{ color: '#28a745', marginTop: '8px' }}>
                      JSON is valid
                    </div>
                  )}
                  <div className="form-description">
                    Configure MCP servers in JSON format. Each server should have a name, command, and optional args/env.
                    <br />
                    Example:
                    <pre style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
{`{
  "desktop-commander": {
    "command": "npx",
    "args": ["-y", "@wonderwhy-er/desktop-commander", "stdio"]
  },
  "file-system": {
    "command": "node",
    "args": ["path/to/server.js"],
    "env": {
      "API_KEY": "your-key"
    }
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

        <div className="settings-window-footer">
          <div className="left">
            <span className={`settings-status ${getStatusClass()}`}>
              {getStatusText()}
            </span>
          </div>
          <div className="right">
            <button
              className="settings-btn secondary"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              className="settings-btn primary"
              onClick={handleSave}
              disabled={isLoading || (!isDirty && !mcpJsonError)}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsWindow
