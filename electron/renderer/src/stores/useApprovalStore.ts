import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { MCPApprovalRequest, MCPClientMessage } from '../types'

interface ApprovalState {
  approvalQueue: MCPApprovalRequest[]
  pendingToolIds: string[]
}

interface ApprovalActions {
  addToQueue: (request: MCPApprovalRequest) => void
  addPendingToolId: (toolId: string) => void
  processPendingTool: () => string
  processApproval: (approved: boolean, sendMessage?: (message: MCPClientMessage) => void) => void
  handleApproval: (approved: boolean, sendMessage?: (message: MCPClientMessage) => void) => void
  clearQueue: () => void
}

type ApprovalStore = ApprovalState & ApprovalActions

const initialState: ApprovalState = {
  approvalQueue: [],
  pendingToolIds: []
}

export const useApprovalStore = create<ApprovalStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Actions
      addToQueue: (request: MCPApprovalRequest) => {
        set((state) => ({
          ...state,
          approvalQueue: [...state.approvalQueue, request]
        }), false, 'addToQueue')
      },

      addPendingToolId: (toolId: string) => {
        set((state) => ({
          ...state,
          pendingToolIds: [...state.pendingToolIds, toolId]
        }), false, 'addPendingToolId')
      },

      processPendingTool: () => {
        const state = get()
        if (state.pendingToolIds.length > 0) {
          const [toolId, ...rest] = state.pendingToolIds
          set({
            pendingToolIds: rest
          }, false, 'processPendingTool')
          return toolId
        }
        return ''
      },

      processApproval: (approved: boolean, sendMessage?: (message: MCPClientMessage) => void) => {
        const state = get()
        const currentRequest = state.approvalQueue[0]
        
        if (currentRequest && sendMessage) {
          sendMessage({
            type: 'approval_response',
            approval_id: currentRequest.approval_id,
            approved
          })
        }

        set({
          approvalQueue: state.approvalQueue.slice(1)
        }, false, 'processApproval')
      },

      handleApproval: (approved: boolean, sendMessage?: (message: MCPClientMessage) => void) => {
        get().processApproval(approved, sendMessage)
      },

      clearQueue: () => {
        set({ approvalQueue: [], pendingToolIds: [] }, false, 'clearQueue')
      }
    }),
    {
      name: 'approval-store'
    }
  )
)

// Selector for current approval request
export const getCurrentApprovalRequest = (state: ApprovalStore): MCPApprovalRequest | null => {
  return state.approvalQueue.length > 0 ? state.approvalQueue[0] : null
}
