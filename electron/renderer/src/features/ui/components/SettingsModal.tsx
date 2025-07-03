import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useUIStore } from '../stores/useUIStore'
import { useConnectionStore } from '../../connection/stores/useConnectionStore'
import './SettingsModal.css'

type TabType = 'general' | 'mcp'

const SettingsModal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [mcpJsonText, setMcpJsonText] = useState('')
  const [mcpJsonError, setMcpJsonError] = useState<string | null>(null)

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

  // Load settings when modal opens
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

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

  const handleModelNameChange = (value: string) => {
    updateSettings({ model_name: value })
  }

  const handleApprovalTimeoutChange = (value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue > 0) {
      updateSettings({ approval_timeout: numValue })
    }
  }

  const handleMcpJsonChange = (value: string) => {
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
                  <label htmlFor="model-name">Model Name</label>
                  <input
                    id="model-name"
                    type="text"
                    value={settings.model_name}
                    onChange={(e) => handleModelNameChange(e.target.value)}
                    placeholder="e.g., openai:gpt-4o-mini"
                  />
                  <div className="form-description">
                    The AI model to use for responses (e.g., openai:gpt-4o-mini, anthropic:claude-3-sonnet).
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
