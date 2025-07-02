import React from 'react'
import { useChatStore } from '../stores/useChatStore'
import { useApprovalStore, getCurrentApprovalRequest } from '../stores/useApprovalStore'
import { useUIStore } from '../stores/useUIStore'
import ApprovalModal from './ApprovalModal'
import MessageHistoryModal from './MessageHistoryModal'

const Modals: React.FC = () => {
  const messages = useChatStore(state => state.messages)
  const sendWebSocketMessage = useChatStore(state => state.sendWebSocketMessage)
  const currentToolSessionId = useChatStore(state => state.currentToolSessionId)
  const updateMessage = useChatStore(state => state.updateMessage)
  
  const currentApprovalRequest = useApprovalStore(getCurrentApprovalRequest)
  const handleApproval = useApprovalStore(state => state.handleApproval)
  
  const isDebugOpen = useUIStore(state => state.isDebugModalOpen)
  const closeDebug = useUIStore(state => state.closeDebug)

  const approve = (approved: boolean) => {
    const req = currentApprovalRequest
    if (req && sendWebSocketMessage && currentToolSessionId) {
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
    
    handleApproval(approved, sendWebSocketMessage || undefined)
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
