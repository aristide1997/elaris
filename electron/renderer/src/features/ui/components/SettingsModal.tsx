import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useUIStore } from '../stores/useUIStore'
import { useConnectionStore } from '../../connection/stores/useConnectionStore'
import { useLLMProviderStore } from '../stores/useLLMProviderStore'
import './SettingsModal.css'

type TabType = 'general' | 'llm' | 'mcp'

const SettingsModal: React.FC = () => {
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

  const { closeSettings } = useUIStore()
  const sendMessage = useConnectionStore(state => state.sendMessage)

  // LLM Provider store
  const {
    availableProviders,
    currentProvider,
    isLoading: isProviderLoading,
    error: providerError,
    loadAvailableProviders,
    loadCurrentProvider,
    testProvider,
    configureProvider,
    clearError: clearProviderError
  } = useLLMProviderStore()

  // Load settings when modal opens
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Load LLM provider data when modal opens
  useEffect(() => {
    if (activeTab === 'llm') {
      loadAvailableProviders()
      loadCurrentProvider()
    }
  }, [activeTab, loadAvailableProviders, loadCurrentProvider])

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

  const handleClose = () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        resetSettings()
        closeSettings()
      }
    } else {
      closeSettings()
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
      closeSettings()
    }
  }

  const handleCancel = () => {
    resetSettings()
    closeSettings()
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

  const handleDebugModeChange = (checked: boolean) => {
    updateSettings({ debug_mode: checked })
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
      <div className="settings-modal-overlay">
        <div className="settings-modal">
          <div className="settings-modal-header">
            <h2 className="settings-modal-title">Settings</h2>
            <button className="settings-modal-close" onClick={closeSettings}>
              ×
            </button>
          </div>
          <div className="settings-modal-content">
            <div className="settings-tab-content">
              <div>Loading settings...</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h2 className="settings-modal-title">Settings</h2>
          <button className="settings-modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="settings-modal-content">
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
                  <label htmlFor="debug-mode">
                    <input
                      id="debug-mode"
                      type="checkbox"
                      checked={settings.debug_mode}
                      onChange={(e) => handleDebugModeChange(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    Debug Mode
                  </label>
                  <div className="form-description">
                    Show debug button and connection status in the header for troubleshooting.
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'llm' && (
              <div>
                {providerError && (
                  <div className="settings-errors">
                    <div>{providerError}</div>
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
                          <label htmlFor="llm-model-input">Model</label>
                          <input
                            id="llm-model-input"
                            type="text"
                            list="model-suggestions"
                            value={selectedModel}
                            onChange={(e) => {
                              setSelectedModel(e.target.value)
                              setTestResult(null)
                              updateLLMProviderSettings(selectedProvider, e.target.value, providerConfig)
                            }}
                            placeholder="Enter model name or select from suggestions..."
                          />
                          <datalist id="model-suggestions">
                            {availableProviders[selectedProvider].default_models.map(model => (
                              <option key={model} value={model} />
                            ))}
                          </datalist>
                          <div className="form-description">
                            Enter the model name to use with this provider. You can type a custom model name or select from the suggestions above.
                            <br />
                            <strong>Common models:</strong> {availableProviders[selectedProvider].default_models.slice(0, 3).join(', ')}
                            {availableProviders[selectedProvider].default_models.length > 3 && '...'}
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
                                  const result = await testProvider(selectedProvider, selectedModel, providerConfig)
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
        </div>

        <div className="settings-modal-footer">
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

export default SettingsModal
