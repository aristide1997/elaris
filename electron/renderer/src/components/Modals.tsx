import React from 'react'
import { useChat } from '../context/ChatContext'
import ApprovalModal from './ApprovalModal'
import MessageHistoryModal from './MessageHistoryModal'
import ConversationListModal from './ConversationListModal'

const Modals: React.FC = () => {
  const {
    currentApprovalRequest,
    approve,
    isDebugOpen,
    closeDebug,
    messages,
    isHistoryOpen,
    closeHistory,
    selectConversation,
    serverPort
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
      <ConversationListModal
        isOpen={isHistoryOpen}
        onClose={closeHistory}
        serverPort={serverPort}
        onSelect={selectConversation}
      />
    </>
  )
}

export default Modals 