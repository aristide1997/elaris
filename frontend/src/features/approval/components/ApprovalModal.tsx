import { useEffect, useState } from 'react'
import type { MCPApprovalRequest } from '../types'
import { useSettingsStore } from '../../ui/stores/useSettingsStore'
import './ApprovalModal.css'

interface ApprovalModalProps {
  request: MCPApprovalRequest
  onApprove: () => void
  onDeny: () => void
}

function ApprovalModal({ request, onApprove, onDeny }: ApprovalModalProps): React.ReactElement | null {
  const [alwaysApprove, setAlwaysApprove] = useState(false)
  const { settings, saveSettings } = useSettingsStore()
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onDeny()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onDeny])

  if (!request) return null

  return (
    <div className="approval-modal-overlay">
      <div className="approval-modal">
        <div className="approval-modal-header">
          <h3>
            <span className="tool-icon">🔧</span>
            Tool Execution Approval
          </h3>
        </div>
        
        <div className="approval-modal-body">
          <div className="approval-modal-field">
            <label>Tool Name</label>
            <div className="field-value">{request.tool_name}</div>
          </div>
          
          <div className="approval-modal-field">
            <label>Arguments</label>
            <pre>{JSON.stringify(request.args, null, 2)}</pre>
          </div>
          
          <div className="approval-warning">
            <div className="warning-icon">!</div>
            <div className="warning-text">
              Do you want to allow this tool to execute?
            </div>
          </div>

          <div className="approval-modal-field" style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
            <label htmlFor="always-approve-checkbox" style={{ fontSize: '14px', fontWeight: 'normal' }}>
              <input
                id="always-approve-checkbox"
                type="checkbox"
                checked={alwaysApprove}
                onChange={(e) => setAlwaysApprove(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Always approve tool calls
            </label>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginLeft: '24px' }}>
              Enable auto-approval for all future tool requests without showing this dialog.
            </div>
          </div>
        </div>
        
        <div className="approval-modal-footer">
          <button 
            className="approval-btn approval-btn-deny" 
            onClick={onDeny}
            type="button"
          >
            <span className="approval-btn-icon">✕</span>
            Deny
          </button>
          <button 
            className="approval-btn approval-btn-approve" 
            onClick={async () => {
              // If "always approve" is checked, update settings first
              if (alwaysApprove && settings) {
                const updatedSettings = { ...settings, auto_approve_tools: true }
                try {
                  await saveSettings(updatedSettings)
                } catch (error) {
                  console.error('Failed to update auto-approve setting:', error)
                }
              }
              onApprove()
            }}
            type="button"
          >
            <span className="approval-btn-icon">✓</span>
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}

export default ApprovalModal
