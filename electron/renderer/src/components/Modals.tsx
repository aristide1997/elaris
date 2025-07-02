import React from 'react'
import { useChat } from '../context/ChatContext'
import ApprovalModal from './ApprovalModal'
import MessageHistoryModal from './MessageHistoryModal'

const Modals: React.FC = () => {
  const {
    currentApprovalRequest,
    approve,
    isDebugOpen,
    closeDebug,
    messages
  } = useChat()

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
