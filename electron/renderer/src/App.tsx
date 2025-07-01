import React, { useState, useEffect, useReducer } from 'react'
import ChatHeader from './components/ChatHeader'
import ChatMessages from './components/ChatMessages'
import ChatInput from './components/ChatInput'
import ApprovalModal from './components/ApprovalModal'
import MessageHistoryModal from './components/MessageHistoryModal'
import ConversationListModal from './components/ConversationListModal'
import { useMCPWebSocket } from './hooks/useMCPWebSocket'
import type { UIMessage, MCPServerMessage, MCPClientMessage, MCPApprovalRequest, ToolSessionMessage, ToolInstance } from './types'
import { messageReducer } from './utils/messageReducer'
import './App.css'

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`

function App() {
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
  
  // Manage conversation ID (client-generated)
  const [conversationId, setConversationId] = useState<string>(() => generateId())
  const [isConversationListOpen, setIsConversationListOpen] = useState<boolean>(false)
  const handleOpenHistory = () => setIsConversationListOpen(true)
  const handleCloseHistory = () => setIsConversationListOpen(false)
  
  const [approvalQueue, setApprovalQueue] = useState<MCPApprovalRequest[]>([])
  const currentApprovalRequest = approvalQueue.length > 0 ? approvalQueue[0] : null
  const [isDebugModalOpen, setIsDebugModalOpen] = useState<boolean>(false)
  
  // Track IDs of tools awaiting approval pairing
  const [pendingToolIds, setPendingToolIds] = useState<string[]>([])
  
  // Intercept approval events to attach the correct tool_id
  function handleRawApprovalRequest(msg: MCPApprovalRequest): void {
    // Pair this approval with the first pending tool start ID
    let assignedToolId: string
    if (pendingToolIds.length > 0) {
      const [tool_id, ...rest] = pendingToolIds
      setPendingToolIds(rest)
      assignedToolId = tool_id
      setApprovalQueue(queue => [...queue, { ...msg, tool_id }])
    } else {
      // Fallback if no pending start: attach empty id
      assignedToolId = ''
      setApprovalQueue(queue => [...queue, { ...msg, tool_id: '' }])
    }
    // Notify reducer to mark the tool pending approval
    dispatch({ type: 'approval_request', payload: { tool_id: assignedToolId } })
  }
  const {
    isConnected,
    sendMessage: sendWebSocketMessage,
    serverPort
  } = useMCPWebSocket({
    onMessage: handleServerMessage,
    onApprovalRequest: handleRawApprovalRequest
  })

  // Unified server message handler – push events into reducer
  function handleServerMessage(message: MCPServerMessage): void {
    // track pending tool starts for approval pairing
    if (message.type === 'tool_start') {
      setPendingToolIds(ids => [...ids, message.tool_id])
    }
    dispatch({ type: message.type, payload: message })
  }

  function handleSendMessage(content: string): void {
    // Add user message via reducer
    dispatch({ type: 'add_user', payload: { content } })
    // Send to backend
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
      // Update tool status via reducer
      dispatch({ type: 'approval_response', payload: { tool_id: req.tool_id, approved } })
      // Notify server
      sendWebSocketMessage({
        type: 'approval_response',
        approval_id: req.approval_id,
        approved
      })
      setApprovalQueue(queue => queue.slice(1))
    }
  }

  // Helper to map Pydantic-AI parts to UIMessage
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

  // Map a loaded conversation into UIMessages, grouping tool calls/returns into tool_session messages
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

  return (
    <div className="app">
      <ChatHeader 
        isConnected={isConnected}
        onDebugClick={() => setIsDebugModalOpen(true)}
        onHistoryClick={handleOpenHistory}
      />
      <ChatMessages messages={chatState.messages} />
      <ChatInput 
        onSendMessage={handleSendMessage}
        disabled={!isConnected}
      />
      {currentApprovalRequest && (
        <ApprovalModal
          request={currentApprovalRequest}
          onApprove={() => handleApproval(true)}
          onDeny={() => handleApproval(false)}
        />
      )}
      <MessageHistoryModal
        messages={chatState.messages}
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
      />
      <ConversationListModal
        isOpen={isConversationListOpen}
        onClose={handleCloseHistory}
        serverPort={serverPort}
        onSelect={async (id: string) => {
          setConversationId(id)
          const url = serverPort
            ? `http://localhost:${serverPort}/api/conversations/${id}`
            : `/api/conversations/${id}`
          const resp = await fetch(url)
          const data = await resp.json()
          const conv = data.conversation
          // Replay loaded conversation through reducer
          const uiMsgs: UIMessage[] = mapConversationToUI(conv)
          dispatch({ type: 'init_messages', payload: { messages: uiMsgs } })
        }}
      />
    </div>
  )
}

export default App
