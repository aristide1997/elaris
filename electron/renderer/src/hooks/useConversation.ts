import { useState, useReducer } from 'react'
import { useMCPWebSocket } from './useMCPWebSocket'
import type { UIMessage, MCPServerMessage, MCPClientMessage, MCPApprovalRequest, ToolSessionMessage, ToolInstance } from '../types'
import { messageReducer } from '../utils/messageReducer'

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`

export function useConversation() {
  const initialMessages: UIMessage[] = [
    {
      id: 'welcome',
      type: 'system',
      content: 'Welcome to MCP Chat Client!\nThis interface provides access to AI with MCP (Model Context Protocol) tools.\nYou\'ll be asked to approve any tool executions for security.',
      timestamp: new Date()
    }
  ]

  const initialState = {
    messages: initialMessages,
    currentAssistantId: null,
    currentToolSessionId: null
  }

  const [chatState, dispatch] = useReducer(messageReducer, initialState)
  const [conversationId, setConversationId] = useState<string>(() => generateId())
  const [isConversationListOpen, setIsConversationListOpen] = useState<boolean>(false)
  const [approvalQueue, setApprovalQueue] = useState<MCPApprovalRequest[]>([])
  const [isDebugModalOpen, setIsDebugModalOpen] = useState<boolean>(false)
  const [pendingToolIds, setPendingToolIds] = useState<string[]>([])

  const currentApprovalRequest = approvalQueue.length > 0 ? approvalQueue[0] : null

  const openHistory = () => setIsConversationListOpen(true)
  const closeHistory = () => setIsConversationListOpen(false)
  const openDebug = () => setIsDebugModalOpen(true)
  const closeDebug = () => setIsDebugModalOpen(false)

  function handleRawApprovalRequest(msg: MCPApprovalRequest): void {
    let assignedToolId: string
    if (pendingToolIds.length > 0) {
      const [tool_id, ...rest] = pendingToolIds
      setPendingToolIds(rest)
      assignedToolId = tool_id
      setApprovalQueue(queue => [...queue, { ...msg, tool_id }])
    } else {
      assignedToolId = ''
      setApprovalQueue(queue => [...queue, { ...msg, tool_id: '' }])
    }
    dispatch({ type: 'approval_request', payload: { tool_id: assignedToolId } })
  }

  function handleServerMessage(message: MCPServerMessage): void {
    if (message.type === 'tool_start') {
      setPendingToolIds(ids => [...ids, message.tool_id])
    }
    dispatch({ type: message.type, payload: message } as any)
  }

  const {
    isConnected,
    sendMessage: sendWebSocketMessage,
    serverPort
  } = useMCPWebSocket({
    onMessage: handleServerMessage,
    onApprovalRequest: handleRawApprovalRequest
  })

  function handleSendMessage(content: string): void {
    dispatch({ type: 'add_user', payload: { content } })
    if (sendWebSocketMessage) {
      sendWebSocketMessage({
        type: 'chat_message',
        conversation_id: conversationId,
        content
      } as MCPClientMessage)
    }
  }

  function handleApproval(approved: boolean): void {
    const req = currentApprovalRequest
    if (req && sendWebSocketMessage) {
      dispatch({ type: 'approval_response', payload: { tool_id: req.tool_id, approved } })
      sendWebSocketMessage({
        type: 'approval_response',
        approval_id: req.approval_id,
        approved
      })
      setApprovalQueue(queue => queue.slice(1))
    }
  }

  function mapPartToUIMessage(part: any): UIMessage {
    const base = {
      id: generateId(),
      timestamp: new Date(part.timestamp),
      content: typeof part.content === 'string' ? part.content : String(part.content)
    }
    switch (part.part_kind) {
      case 'system-prompt':
        return { ...base, type: 'system', subtype: 'info' }
      case 'user-prompt':
        return { ...base, type: 'user' }
      case 'text':
        return { ...base, type: 'assistant' }
      case 'tool-call':
        return {
          ...base,
          type: 'system',
          subtype: 'info',
          content: `Tool call: ${part.tool_name}(${typeof part.args === 'object' ? JSON.stringify(part.args) : part.args})`
        }
      case 'tool-return':
        return {
          ...base,
          type: 'system',
          subtype: 'info',
          content: `Tool result: ${part.tool_name} => ${typeof part.content === 'string' ? part.content : JSON.stringify(part.content)}`
        }
      case 'retry-prompt':
        return {
          ...base,
          type: 'system',
          subtype: 'error',
          content: `Retry prompt: ${typeof part.content === 'string' ? part.content : JSON.stringify(part.content)}`
        }
      default:
        return { ...base, type: 'system', subtype: 'error' }
    }
  }

  function mapConversationToUI(conv: { messages: any[] }): UIMessage[] {
    const uiMsgs: UIMessage[] = []
    const sessionsMap: Record<string, ToolSessionMessage> = {}
    conv.messages.forEach((msg: any) => {
      if (Array.isArray(msg.parts)) {
        msg.parts.forEach((part: any) => {
          switch (part.part_kind) {
            case 'tool-call': {
              const session: ToolSessionMessage = {
                id: generateId(),
                type: 'tool_session',
                timestamp: new Date(part.timestamp),
                status: 'completed',
                tools: [{ id: part.tool_call_id, name: part.tool_name, status: 'completed', timestamp: new Date(part.timestamp) }],
              }
              sessionsMap[part.tool_call_id] = session
              uiMsgs.push(session)
              break
            }
            case 'tool-return': {
              const session = sessionsMap[part.tool_call_id]
              if (session) {
                session.tools = session.tools.map((tool: ToolInstance) =>
                  tool.id === part.tool_call_id
                    ? { ...tool, result: typeof part.content === 'string' ? part.content : JSON.stringify(part.content) }
                    : tool
                )
              }
              break
            }
            default:
              uiMsgs.push(mapPartToUIMessage(part))
          }
        })
      } else {
        uiMsgs.push(mapPartToUIMessage(msg))
      }
    })
    return uiMsgs
  }

  const selectConversation = async (id: string) => {
    setConversationId(id)
    const url = serverPort
      ? `http://localhost:${serverPort}/api/conversations/${id}`
      : `/api/conversations/${id}`
    const resp = await fetch(url)
    const data = await resp.json()
    const conv = data.conversation
    const uiMsgs: UIMessage[] = mapConversationToUI(conv)
    dispatch({ type: 'init_messages', payload: { messages: uiMsgs } })
  }

  const startNewChat = () => {
    const newConversationId = generateId()
    setConversationId(newConversationId)
    dispatch({ type: 'init_messages', payload: { messages: initialMessages } })
    setIsConversationListOpen(false)
  }

  return {
    messages: chatState.messages,
    isConnected,
    sendMessage: handleSendMessage,
    currentApprovalRequest,
    approve: handleApproval,
    isHistoryOpen: isConversationListOpen,
    openHistory,
    closeHistory,
    isDebugOpen: isDebugModalOpen,
    openDebug,
    closeDebug,
    selectConversation,
    startNewChat,
    serverPort
  }
}
