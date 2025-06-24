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
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>🔧 Tool Execution Approval</h3>
        </div>
        <div className="modal-body">
          <p><strong>Tool:</strong> {request.tool_name}</p>
          <p><strong>Arguments:</strong></p>
          <pre>{JSON.stringify(request.args, null, 2)}</pre>
          <p className="warning">⚠️ Do you want to allow this tool to execute?</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-danger" onClick={onDeny}>
            ❌ Deny
          </button>
          <button className="btn btn-success" onClick={onApprove}>
            ✅ Approve
          </button>
        </div>
      </div>
    </div>
  )
}

export default ApprovalModal 