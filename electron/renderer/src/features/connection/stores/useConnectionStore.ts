import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ClientToServerMessage } from '../../../protocol/messages'

interface ConnectionState {
  isConnected: boolean
  serverPort: number | null
  sendWebSocketMessage: ((message: ClientToServerMessage) => void) | null
}

interface ConnectionActions {
  setConnection: (connected: boolean, serverPort?: number | null, sendFn?: ((message: ClientToServerMessage) => void) | null) => void
  sendMessage: (message: ClientToServerMessage) => void
}

type ConnectionStore = ConnectionState & ConnectionActions

const initialState: ConnectionState = {
  isConnected: false,
  serverPort: null,
  sendWebSocketMessage: null
}

export const useConnectionStore = create<ConnectionStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setConnection: (connected: boolean, serverPort?: number | null, sendFn?: ((message: ClientToServerMessage) => void) | null) => {
        set({ 
          isConnected: connected,
          serverPort: serverPort ?? null,
          sendWebSocketMessage: sendFn ?? null
        }, false, 'setConnection')
      },

      sendMessage: (message: ClientToServerMessage) => {
        const { sendWebSocketMessage } = get()
        if (sendWebSocketMessage) {
          sendWebSocketMessage(message)
        }
      }
    }),
    {
      name: 'connection-store'
    }
  )
) 