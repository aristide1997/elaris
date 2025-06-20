import { useEffect } from 'react'
import './ApprovalModal.css'

function ApprovalModal({ request, onApprove, onDeny }) {
  useEffect(() => {
    const handleEscape = (e) => {
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