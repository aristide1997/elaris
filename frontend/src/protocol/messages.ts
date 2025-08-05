// This file defines the full schema for messages passed over the WebSocket

// Messages from Server → Client
export interface SystemReadyEvent {
  type: 'system_ready'
  message: string
}

export interface AssistantStartEvent {
  type: 'assistant_start'
}

export interface TextDeltaEvent {
  type: 'text_delta'
  content: string
}

export interface AssistantCompleteEvent {
  type: 'assistant_complete'
}

export interface ThinkingStartEvent {
  type: 'thinking_start'
}

export interface ThinkingDeltaEvent {
  type: 'thinking_delta'
  content: string
}

export interface ThinkingCompleteEvent {
  type: 'thinking_complete'
}

export interface ToolSessionStartEvent {
  type: 'tool_session_start'
}

export interface ToolStartEvent {
  type: 'tool_start'
  tool_name: string
  tool_id: string
}

export interface ToolCompleteEvent {
  type: 'tool_complete'
  tool_id: string
  tool_name: string
  content: string
}

export interface ToolBlockedEvent {
  type: 'tool_blocked'
  tool_id: string
  tool_name: string
}

export interface ToolErrorEvent {
  type: 'tool_error'
  tool_id: string
  tool_name: string
  error: string
}

export interface ToolSessionCompleteEvent {
  type: 'tool_session_complete'
}

export interface ApprovalRequestEvent {
  type: 'approval_request'
  approval_id: string
  tool_id: string
  tool_name: string
  args: Record<string, any>
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export interface SettingsUpdatedEvent {
  type: 'settings_updated'
  settings: Record<string, any>
}

export type ServerToClientMessage =
  | SystemReadyEvent
  | AssistantStartEvent
  | TextDeltaEvent
  | AssistantCompleteEvent
  | ThinkingStartEvent
  | ThinkingDeltaEvent
  | ThinkingCompleteEvent
  | ToolSessionStartEvent
  | ToolStartEvent
  | ToolCompleteEvent
  | ToolBlockedEvent
  | ToolErrorEvent
  | ToolSessionCompleteEvent
  | ApprovalRequestEvent
  | ErrorEvent
  | SettingsUpdatedEvent

// Messages from Client → Server
export interface ChatMessage {
  type: 'chat_message'
  content: string
  conversation_id: string
}

export interface ApprovalResponseMessage {
  type: 'approval_response'
  approval_id: string
  approved: boolean
}

export interface UpdateSettingsMessage {
  type: 'update_settings'
  settings: Record<string, any>
}

export interface StopStreamMessage {
  type: 'stop_stream'
  conversation_id: string
}

export interface EditUserMessageMessage {
  type: 'edit_user_message'
  conversation_id: string
  user_message_index: number
  new_content: string
}

export type ClientToServerMessage =
  | ChatMessage
  | ApprovalResponseMessage
  | UpdateSettingsMessage
  | StopStreamMessage
  | EditUserMessageMessage
