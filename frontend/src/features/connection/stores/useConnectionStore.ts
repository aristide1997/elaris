import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ClientToServerMessage } from '../../../protocol/messages'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

interface ConnectionState {
  status: ConnectionStatus
  serverPort: number | null
  sendWebSocketMessage: ((message: ClientToServerMessage) => void) | null
  error: string | null
  lastConnected: Date | null
  reconnectAttempts: number
}

interface ConnectionActions {
  setConnectionStatus: (status: ConnectionStatus, error?: string | null) => void
  setServerPort: (port: number | null) => void
  setSendFunction: (sendFn: ((message: ClientToServerMessage) => void) | null) => void
  incrementReconnectAttempts: () => void
  resetReconnectAttempts: () => void
  sendMessage: (message: ClientToServerMessage) => void
  markConnected: (serverPort: number | null, sendFn: ((message: ClientToServerMessage) => void) | null) => void
  markDisconnected: (error?: string | null) => void
}

type ConnectionStore = ConnectionState & ConnectionActions

const initialState: ConnectionState = {
  status: 'disconnected',
  serverPort: null,
  sendWebSocketMessage: null,
  error: null,
  lastConnected: null,
  reconnectAttempts: 0
}

export const useConnectionStore = create<ConnectionStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setConnectionStatus: (status: ConnectionStatus, error?: string | null) => {
        set({ 
          status,
          error: error ?? null
        }, false, 'setConnectionStatus')
      },

      setServerPort: (port: number | null) => {
        set({ serverPort: port }, false, 'setServerPort')
      },

      setSendFunction: (sendFn: ((message: ClientToServerMessage) => void) | null) => {
        set({ sendWebSocketMessage: sendFn }, false, 'setSendFunction')
      },

      incrementReconnectAttempts: () => {
        set((state) => ({ 
          reconnectAttempts: state.reconnectAttempts + 1 
        }), false, 'incrementReconnectAttempts')
      },

      resetReconnectAttempts: () => {
        set({ reconnectAttempts: 0 }, false, 'resetReconnectAttempts')
      },

      markConnected: (serverPort: number | null, sendFn: ((message: ClientToServerMessage) => void) | null) => {
        set({ 
          status: 'connected',
          serverPort,
          sendWebSocketMessage: sendFn,
          error: null,
          lastConnected: new Date(),
          reconnectAttempts: 0
        }, false, 'markConnected')
      },

      markDisconnected: (error?: string | null) => {
        const wasConnected = get().status === 'connected'
        set({ 
          status: wasConnected ? 'reconnecting' : 'disconnected',
          sendWebSocketMessage: null,
          error: error ?? null
        }, false, 'markDisconnected')
      },

      sendMessage: (message: ClientToServerMessage) => {
        const { sendWebSocketMessage, status } = get()
        if (sendWebSocketMessage && status === 'connected') {
          sendWebSocketMessage(message)
        } else {
          console.warn('Cannot send message: WebSocket not connected', { status, message })
        }
      }
    }),
    {
      name: 'connection-store'
    }
  )
)

// Convenience selectors
export const useConnectionStatus = () => useConnectionStore(state => state.status)
export const useIsConnected = () => useConnectionStore(state => state.status === 'connected')
export const useIsReconnecting = () => useConnectionStore(state => state.status === 'reconnecting')
