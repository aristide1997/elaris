import type { ClientToServerMessage } from '../../protocol/messages'

export interface ConnectionState {
  isConnected: boolean
  serverPort: number | null
  sendWebSocketMessage: ((message: ClientToServerMessage) => void) | null
}

export interface ConnectionActions {
  setConnection: (connected: boolean, serverPort?: number | null, sendFn?: ((message: ClientToServerMessage) => void) | null) => void
  sendMessage: (message: ClientToServerMessage) => void
}

export type ConnectionStore = ConnectionState & ConnectionActions 