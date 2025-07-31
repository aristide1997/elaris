import { useApprovalStore, getCurrentApprovalRequest } from '../stores/useApprovalStore'
import type { MCPApprovalRequest } from '../types'

export interface UseApprovalFlowReturn {
  currentApprovalRequest: MCPApprovalRequest | null
  handleApproval: (approved: boolean, sendMessage?: (message: any) => void) => void
  addToQueue: (request: MCPApprovalRequest) => void
  addPendingToolId: (toolId: string) => void
  processPendingTool: () => string
  clearQueue: () => void
}

export const useApprovalFlow = (): UseApprovalFlowReturn => {
  const currentApprovalRequest = useApprovalStore(getCurrentApprovalRequest)
  const handleApproval = useApprovalStore(state => state.handleApproval)
  const addToQueue = useApprovalStore(state => state.addToQueue)
  const addPendingToolId = useApprovalStore(state => state.addPendingToolId)
  const processPendingTool = useApprovalStore(state => state.processPendingTool)
  const clearQueue = useApprovalStore(state => state.clearQueue)

  return {
    currentApprovalRequest,
    handleApproval,
    addToQueue,
    addPendingToolId,
    processPendingTool,
    clearQueue
  }
}
