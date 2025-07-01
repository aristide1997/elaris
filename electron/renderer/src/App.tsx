import React, { useState, useEffect, useRef } from 'react'
import ChatHeader from './components/ChatHeader'
import ChatMessages from './components/ChatMessages'
import ChatInput from './components/ChatInput'
import ApprovalModal from './components/ApprovalModal'
import MessageHistoryModal from './components/MessageHistoryModal'
import ConversationListModal from './components/ConversationListModal'
import { useMCPWebSocket } from './hooks/useMCPWebSocket'
import type { UIMessage, MCPServerMessage, MCPClientMessage, MCPApprovalRequest, ToolSessionMessage, ToolInstance } from './types'
import './App.css'

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`

function App() {
  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: 'welcome',  // static welcome message
      type: 'system',
      content: 'Welcome to MCP Chat Client!\nThis interface provides access to AI with MCP (Model Context Protocol) tools.\nYou\'ll be asked to approve any tool executions for security.',
      timestamp: new Date()
    }
  ])
  
  // Manage conversation ID (client-generated)
  const [conversationId, setConversationId] = useState<string>(() => generateId())
  const [isConversationListOpen, setIsConversationListOpen] = useState<boolean>(false)
  const handleOpenHistory = () => setIsConversationListOpen(true)
  const handleCloseHistory = () => setIsConversationListOpen(false)
  
  const [approvalQueue, setApprovalQueue] = useState<MCPApprovalRequest[]>([])
  const currentApprovalRequest = approvalQueue.length > 0 ? approvalQueue[0] : null
  const [isDebugModalOpen, setIsDebugModalOpen] = useState<boolean>(false)
  // Track current assistant message ID via ref for synchronous updates
  const currentAssistantIdRef = useRef<string | null>(null)
  // Track current tool session ID
  const currentToolSessionIdRef = useRef<string | null>(null)
  
  // Track IDs of tools awaiting approval pairing
  const [pendingToolIds, setPendingToolIds] = useState<string[]>([])
  
  // Intercept approval events to attach the correct tool_id
  function handleRawApprovalRequest(msg: MCPApprovalRequest): void {
    // Pair this approval with the first pending tool start ID
    if (pendingToolIds.length > 0) {
      const [tool_id, ...rest] = pendingToolIds
      setPendingToolIds(rest)
      setApprovalQueue(queue => [...queue, { ...msg, tool_id }])
    } else {
      // Fallback if no pending start: attach no id
      setApprovalQueue(queue => [...queue, { ...msg, tool_id: '' }])
    }
  }
  const {
    isConnected,
    sendMessage: sendWebSocketMessage,
    serverPort
  } = useMCPWebSocket({
    onMessage: handleWebSocketMessage,
    onApprovalRequest: handleRawApprovalRequest
  })

  function handleWebSocketMessage(message: MCPServerMessage): void {
    console.log('Received message:', message)
    
    switch (message.type) {
      case 'system_ready':
        addMessage('system', message.message)
        break
        
      case 'assistant_start':
        console.log('Starting new assistant message')
        if (!currentAssistantIdRef.current) {
          const newId = generateId()
          const newAssistantMsg = {
            id: newId,
            type: 'assistant',
            content: '',
            timestamp: new Date()
          } as UIMessage
          currentAssistantIdRef.current = newId
          setMessages(prev => [...prev, newAssistantMsg])
        }
        break
        
      case 'text_delta':
        console.log('Received text_delta:', message.content)
        let msgId = currentAssistantIdRef.current
        if (!msgId) {
          console.log('No assistant message, creating one from text_delta')
          msgId = generateId()
          currentAssistantIdRef.current = msgId
          const fallbackMsg = { id: msgId, type: 'assistant', content: '', timestamp: new Date() } as UIMessage
          setMessages(prev => [...prev, fallbackMsg])
        }
        setMessages(prev => prev.map(msg =>
          msg.id === msgId
            ? { ...msg, content: msg.content + message.content }
            : msg
        ))
        break
        
      case 'assistant_complete':
        currentAssistantIdRef.current = null
        break
      
      // New graph-aligned tool events
      case 'tool_session_start':
        console.log('Starting tool session')
        const toolSessionId = generateId()
        currentToolSessionIdRef.current = toolSessionId
        const toolSessionMsg = {
          id: toolSessionId,
          type: 'tool_session',
          tools: [],
          status: 'executing',
          timestamp: new Date()
        } as UIMessage
        setMessages(prev => [...prev, toolSessionMsg])
        break
        
      case 'tool_start':
        console.log('Tool starting:', message.tool_name, message.tool_id)
        if (currentToolSessionIdRef.current) {
          setMessages(prev => prev.map(msg =>
            msg.id === currentToolSessionIdRef.current
              ? {
                  ...msg,
                  tools: [...(msg.tools ?? []), {
                    id: message.tool_id,
                    name: message.tool_name,
                    status: 'pending_approval',
                    timestamp: new Date()
                  }]
                }
              : msg
          ))
          // Record this tool_id so we can pair with the next approval request
          setPendingToolIds(ids => [...ids, message.tool_id])
        }
        break
        
      case 'tool_complete':
        console.log('Tool completed:', message.tool_id)
        if (currentToolSessionIdRef.current) {
          setMessages(prev => prev.map(msg =>
            msg.id === currentToolSessionIdRef.current
              ? {
                  ...msg,
                  status: 'completed',
                  tools: (msg.tools ?? []).map(tool =>
                    tool.id === message.tool_id
                      ? { ...tool, status: 'completed', result: message.content }
                      : tool
                  )
                }
              : msg
          ))
        }
        break
        
      case 'tool_blocked':
        console.log('Tool blocked:', message.tool_id)
        if (currentToolSessionIdRef.current) {
          setMessages(prev => prev.map(msg =>
            msg.id === currentToolSessionIdRef.current
              ? {
                  ...msg,
                  status: 'blocked',
                  tools: (msg.tools ?? []).map(tool =>
                    tool.id === message.tool_id
                      ? { ...tool, status: 'blocked' }
                      : tool
                  )
                }
              : msg
          ))
        }
        break
        
      case 'tool_session_complete':
        console.log('Tool session completed')
        if (currentToolSessionIdRef.current) {
          setMessages(prev => prev.map(msg =>
            msg.id === currentToolSessionIdRef.current
              ? { 
                  ...msg, 
                  status: (msg.tools ?? []).some(tool => tool.status === 'blocked') ? 'blocked' : 'completed'
                }
              : msg
          ))
          currentToolSessionIdRef.current = null
        }
        break

      case 'error':
        addMessage('system', `❌ Error: ${message.message}`, 'error')
        break
        
      default:
        console.warn('Unknown message type:', message.type, message)
    }
  }

  function addMessage(
    type: 'system' | 'user',
    content: string,
    subtype: 'info' | 'error' = 'info'
  ): void {
    const newMessage: UIMessage = {
      id: generateId(),
      type,
      subtype,
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
  }

  function handleSendMessage(content: string): void {
    // Add user message to UI
    addMessage('user', content)
    
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
      // Update tool status based on approval
      if (currentToolSessionIdRef.current) {
        setMessages(prev => prev.map(msg =>
          msg.id === currentToolSessionIdRef.current
            ? {
                ...msg,
                tools: (() => {
                  let updated = false
                  return (msg.tools ?? []).map(tool => {
                    if (!updated && tool.id === req.tool_id && tool.status === 'pending_approval') {
                      updated = true
                      return { ...tool, status: approved ? 'executing' : 'blocked' }
                    }
                    return tool
                  })
                })()
              }
            : msg
        ))
      }
      
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
                session.tools = session.tools.map(tool =>
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
      <ChatMessages messages={messages} />
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
        messages={messages}
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
          // Convert saved conversation to UI messages, grouping tool sessions
          const uiMsgs: UIMessage[] = mapConversationToUI(conv)
          setMessages(uiMsgs)
        }}
      />
    </div>
  )
}

export default App
