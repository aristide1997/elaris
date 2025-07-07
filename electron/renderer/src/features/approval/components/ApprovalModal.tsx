import React, { useEffect } from 'react'
import type { MCPApprovalRequest } from '../types'
import './ApprovalModal.css'

interface ApprovalModalProps {
  request: MCPApprovalRequest
  onApprove: () => void
  onDeny: () => void
}

function ApprovalModal({ request, onApprove, onDeny }: ApprovalModalProps): React.ReactElement | null {
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
            onClick={onApprove}
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
