import React, { useState, useEffect, useRef } from 'react'
import ChatHeader from './components/ChatHeader'
import ChatMessages from './components/ChatMessages'
import ChatInput from './components/ChatInput'
import ApprovalModal from './components/ApprovalModal'
import MessageHistoryModal from './components/MessageHistoryModal'
import { useMCPWebSocket } from './hooks/useMCPWebSocket'
import type { UIMessage, MCPServerMessage, MCPClientMessage, MCPApprovalRequest } from './types'
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
  
  const [approvalRequest, setApprovalRequest] = useState<MCPApprovalRequest | null>(null)
  const [isDebugModalOpen, setIsDebugModalOpen] = useState<boolean>(false)
  // Track current assistant message ID via ref for synchronous updates
  const currentAssistantIdRef = useRef<string | null>(null)
  // Track current tool session ID
  const currentToolSessionIdRef = useRef<string | null>(null)
  
  const {
    isConnected,
    sendMessage: sendWebSocketMessage,
    serverPort
  } = useMCPWebSocket({
    onMessage: handleWebSocketMessage,
    onApprovalRequest: setApprovalRequest
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
          }
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
          const fallbackMsg = { id: msgId, type: 'assistant', content: '', timestamp: new Date() }
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
        }
        setMessages(prev => [...prev, toolSessionMsg])
        break
        
      case 'tool_start':
        console.log('Tool starting:', message.tool_name, message.tool_id)
        if (currentToolSessionIdRef.current) {
          setMessages(prev => prev.map(msg =>
            msg.id === currentToolSessionIdRef.current
              ? {
                  ...msg,
                  tools: [...msg.tools, {
                    id: message.tool_id,
                    name: message.tool_name,
                    status: 'pending_approval',
                    timestamp: new Date()
                  }]
                }
              : msg
          ))
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
                  tools: msg.tools.map(tool =>
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
                  tools: msg.tools.map(tool =>
                    tool.id === message.tool_id
                      ? { ...tool, status: 'blocked' }
                      : tool
                  )
                }
              : msg
          ))
        }
        break
        
      case 'tool_error':
        console.log('Tool error:', message.tool_id)
        if (currentToolSessionIdRef.current) {
          setMessages(prev => prev.map(msg =>
            msg.id === currentToolSessionIdRef.current
              ? {
                  ...msg,
                  tools: msg.tools.map(tool =>
                    tool.id === message.tool_id
                      ? { ...tool, status: 'error', result: message.error }
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
                  status: msg.tools.some(tool => tool.status === 'blocked') ? 'blocked' : 'completed'
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

  function addMessage(type, content, subtype = 'info') {
    const newMessage = {
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
        content
      })
    }
  }

  function handleApproval(approved: boolean): void {
    if (approvalRequest && sendWebSocketMessage) {
      // Update tool status based on approval
      if (currentToolSessionIdRef.current) {
        setMessages(prev => prev.map(msg =>
          msg.id === currentToolSessionIdRef.current
            ? {
                ...msg,
                tools: msg.tools.map(tool =>
                  tool.name === approvalRequest.tool_name && tool.status === 'pending_approval'
                    ? { ...tool, status: approved ? 'executing' : 'blocked' }
                    : tool
                )
              }
            : msg
        ))
      }
      
      sendWebSocketMessage({
        type: 'approval_response',
        approval_id: approvalRequest.approval_id,
        approved
      })
      setApprovalRequest(null)
    }
  }

  return (
    <div className="app">
      <ChatHeader 
        isConnected={isConnected} 
        onDebugClick={() => setIsDebugModalOpen(true)}
      />
      <ChatMessages messages={messages} />
      <ChatInput 
        onSendMessage={handleSendMessage}
        disabled={!isConnected}
      />
      {approvalRequest && (
        <ApprovalModal
          request={approvalRequest}
          onApprove={() => handleApproval(true)}
          onDeny={() => handleApproval(false)}
        />
      )}
      <MessageHistoryModal
        messages={messages}
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
      />
    </div>
  )
}

export default App
