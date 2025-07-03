import type { ApprovalRequestEvent, ClientToServerMessage } from '../../protocol/messages'

export type MCPApprovalRequest = ApprovalRequestEvent

export type ToolStatus = 'pending_approval' | 'executing' | 'completed' | 'blocked'

export interface ToolInstance {
  id: string
  name: string
  status: ToolStatus
  timestamp: Date
  result?: string
}

export interface ApprovalState {
  approvalQueue: MCPApprovalRequest[]
  pendingToolIds: string[]
}

export interface ApprovalActions {
  addToQueue: (request: MCPApprovalRequest) => void
  addPendingToolId: (toolId: string) => void
  processPendingTool: () => string
  processApproval: (approved: boolean, sendMessage?: (message: ClientToServerMessage) => void) => void
  handleApproval: (approved: boolean, sendMessage?: (message: ClientToServerMessage) => void) => void
  clearQueue: () => void
}

export type ApprovalStore = ApprovalState & ApprovalActions

export interface UseApprovalFlowReturn {
  currentApprovalRequest: MCPApprovalRequest | null
  handleApproval: (approved: boolean, sendMessage?: (message: ClientToServerMessage) => void) => void
  addToQueue: (request: MCPApprovalRequest) => void
  addPendingToolId: (toolId: string) => void
  processPendingTool: () => string
  clearQueue: () => void
} 