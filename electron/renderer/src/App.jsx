import { useState, useEffect, useRef } from 'react'
import ChatHeader from './components/ChatHeader'
import ChatMessages from './components/ChatMessages'
import ChatInput from './components/ChatInput'
import ApprovalModal from './components/ApprovalModal'
import MessageHistoryModal from './components/MessageHistoryModal'
import { useMCPWebSocket } from './hooks/useMCPWebSocket'
import './App.css'

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2,9)}`

function App() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',  // static welcome message
      type: 'system',
      content: 'Welcome to MCP Chat Client!\nThis interface provides access to AI with MCP (Model Context Protocol) tools.\nYou\'ll be asked to approve any tool executions for security.',
      timestamp: new Date()
    }
  ])
  
  const [approvalRequest, setApprovalRequest] = useState(null)
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false)
  // Track current assistant message ID via ref for synchronous updates
  const currentAssistantIdRef = useRef(null)
  
  const {
    isConnected,
    sendMessage: sendWebSocketMessage,
    serverPort
  } = useMCPWebSocket({
    onMessage: handleWebSocketMessage,
    onApprovalRequest: setApprovalRequest
  })

  function handleWebSocketMessage(message) {
    console.log('Received message:', message)
    
    switch (message.type) {
      case 'system_ready':
        addMessage('system', message.message)
        break
        
      case 'assistant_start':
        console.log('Starting new assistant message')
        // Only create a new assistant message if none is currently open (reuse fallback bubbles)
        if (!currentAssistantIdRef.current) {
          const newId = generateId()
          const newAssistantMsg = {
            id: newId,
            type: 'assistant',
            content: '',
            tools: [],
            timestamp: new Date()
          }
          currentAssistantIdRef.current = newId
          setMessages(prev => [...prev, newAssistantMsg])
        }
        break
        
      case 'text_delta':
        console.log('Received text_delta:', message.content)
        // Determine which assistant message to update
        let msgId = currentAssistantIdRef.current
        // Fallback if no active assistant message
        if (!msgId) {
          console.log('No assistant message, creating one from text_delta')
          msgId = generateId()
          currentAssistantIdRef.current = msgId
          const fallbackMsg = { id: msgId, type: 'assistant', content: '', tools: [], timestamp: new Date() }
          setMessages(prev => [...prev, fallbackMsg])
        }
        // Append the delta content to the assistant message with msgId
        setMessages(prev => prev.map(msg =>
          msg.id === msgId
            ? { ...msg, content: msg.content + message.content }
            : msg
        ))
        break
        
      case 'assistant_complete':
        // Clear the current assistant message ID
        currentAssistantIdRef.current = null
        break
        
      case 'tool_executing':
        // Handle tool executing update, grouping by assistant message or fallback
        {
          const toolUpdate = { type: 'executing', name: message.tool_name, timestamp: new Date() }
          if (currentAssistantIdRef.current) {
            // Append to current assistant message
            setMessages(prev => prev.map(msg =>
              msg.id === currentAssistantIdRef.current
                ? { ...msg, tools: [...msg.tools, toolUpdate] }
                : msg
            ))
          } else {
            // Fallback: create a new assistant message for the tool update
            const newId = generateId()
            currentAssistantIdRef.current = newId
            const newMsg = { id: newId, type: 'assistant', content: '', tools: [toolUpdate], timestamp: new Date() }
            setMessages(prev => [...prev, newMsg])
          }
        }
        break
        
      case 'tool_blocked':
        // Handle tool blocked update, grouping by assistant message or fallback
        {
          const toolUpdate = { type: 'blocked', name: message.tool_name, timestamp: new Date() }
          if (currentAssistantIdRef.current) {
            setMessages(prev => prev.map(msg =>
              msg.id === currentAssistantIdRef.current
                ? { ...msg, tools: [...msg.tools, toolUpdate] }
                : msg
            ))
          } else {
            const newId = generateId()
            currentAssistantIdRef.current = newId
            const newMsg = { id: newId, type: 'assistant', content: '', tools: [toolUpdate], timestamp: new Date() }
            setMessages(prev => [...prev, newMsg])
          }
        }
        break
        
      case 'tool_result':
        // Handle tool result update, grouping by assistant message or fallback
        {
          const toolUpdate = { type: 'result', content: message.content, timestamp: new Date() }
          if (currentAssistantIdRef.current) {
            setMessages(prev => prev.map(msg =>
              msg.id === currentAssistantIdRef.current
                ? { ...msg, tools: [...msg.tools, toolUpdate] }
                : msg
            ))
          } else {
            const newId = generateId()
            currentAssistantIdRef.current = newId
            const newMsg = { id: newId, type: 'assistant', content: '', tools: [toolUpdate], timestamp: new Date() }
            setMessages(prev => [...prev, newMsg])
          }
        }
        break
        
      case 'tool_result_blocked':
        // Handle tool result blocked update, grouping by assistant message or fallback
        {
          const toolUpdate = { type: 'result_blocked', timestamp: new Date() }
          if (currentAssistantIdRef.current) {
            setMessages(prev => prev.map(msg =>
              msg.id === currentAssistantIdRef.current
                ? { ...msg, tools: [...msg.tools, toolUpdate] }
                : msg
            ))
          } else {
            const newId = generateId()
            currentAssistantIdRef.current = newId
            const newMsg = { id: newId, type: 'assistant', content: '', tools: [toolUpdate], timestamp: new Date() }
            setMessages(prev => [...prev, newMsg])
          }
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

  function handleSendMessage(content) {
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

  function handleApproval(approved) {
    if (approvalRequest && sendWebSocketMessage) {
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
