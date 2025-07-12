import React from 'react'
import { useMessagesStore } from '../../features/chat'
import { useConnectionStore } from '../../features/connection'
import { useApprovalFlow, ApprovalModal } from '../../features/approval'
import { useUIStore, MessageHistoryModal } from '../../features/ui'

const Modals: React.FC = () => {
  const { messages, currentToolSessionId, updateMessage } = useMessagesStore()
  const { sendMessage } = useConnectionStore()
  
  const { currentApprovalRequest, handleApproval } = useApprovalFlow()
  
  const isDebugOpen = useUIStore(state => state.isDebugModalOpen)
  const closeDebug = useUIStore(state => state.closeDebug)

  const approve = (approved: boolean) => {
    const req = currentApprovalRequest
    if (req && currentToolSessionId) {
      // Update tool status in UI
      const sessionMessage = messages.find(m => m.id === currentToolSessionId)
      if (sessionMessage && sessionMessage.type === 'tool_session') {
        const updatedTools = (sessionMessage.tools || []).map((t) => {
          if (t.id === req.tool_id && t.status === 'pending_approval') {
            return { ...t, status: approved ? 'executing' as const : 'blocked' as const }
          }
          return t
        })
        updateMessage(currentToolSessionId, { tools: updatedTools })
      }
    }
    
    handleApproval(approved, sendMessage)
  }

  return (
    <>
      {currentApprovalRequest && (
        <ApprovalModal
          request={currentApprovalRequest}
          onApprove={() => approve(true)}
          onDeny={() => approve(false)}
        />
      )}
      <MessageHistoryModal
        messages={messages}
        isOpen={isDebugOpen}
        onClose={closeDebug}
      />
    </>
  )
}

export default Modals
export { Modals }
