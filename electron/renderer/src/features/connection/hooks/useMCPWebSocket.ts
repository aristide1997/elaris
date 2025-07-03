import type { ServerToClientMessage, ClientToServerMessage } from '../../../protocol/messages'
import type { MCPApprovalRequest } from '../../approval/types'

type MCPServerMessage = ServerToClientMessage
type MCPClientMessage = ClientToServerMessage
import { useState, useEffect, useRef, useCallback } from 'react'

interface UseMCPWebSocketParams {
  onMessage: (message: MCPServerMessage) => void
  onApprovalRequest?: (request: MCPApprovalRequest) => void
}

export function useMCPWebSocket({ onMessage, onApprovalRequest }: UseMCPWebSocketParams): {
  isConnected: boolean
  sendMessage: (message: MCPClientMessage) => void
  serverPort: number | null
} {
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [serverPort, setServerPort] = useState<number | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Setup Electron listeners
  useEffect(() => {
    if (window.electronAPI) {
      const handleServerPort = (event: any, port: number): void => {
        console.log('Received server port from Electron:', port)
        setServerPort(port)
      }

      window.electronAPI.onServerPort(handleServerPort)

      return () => {
        if (window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners('server-port')
        }
      }
    }
  }, [])

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Don't create a new connection if one already exists
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting, skipping...')
      return
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping...')
      return
    }

    let wsUrl
    
    if (serverPort) {
      // Running in Electron - connect to localhost with dynamic port
      wsUrl = `ws://localhost:${serverPort}/ws`
    } else {
      // Running in browser - use current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      wsUrl = `${protocol}//${window.location.host}/ws`
    }
    
    console.log('Connecting to WebSocket:', wsUrl)
    
    try {
      wsRef.current = new WebSocket(wsUrl)
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        // Clear any pending reconnection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          // Handle approval requests specially
          if (message.type === 'approval_request') {
            onApprovalRequest?.(message)
          } else {
            onMessage?.(message)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }
      
      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        
        // Only attempt to reconnect if we're not already trying to reconnect
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null
            connect()
          }, 3000)
        }
      }
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setIsConnected(false)
    }
  }, [serverPort, onMessage, onApprovalRequest])

  // Connect when serverPort is available or immediately if not in Electron
  useEffect(() => {
    if (serverPort || !window.electronAPI) {
      // Only connect if we don't already have a connection
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connect()
      }
    }
  }, [serverPort, connect])

  // Send message function
  const sendMessage = useCallback((message: MCPClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send message:', message)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  return {
    isConnected,
    sendMessage,
    serverPort
  }
} 