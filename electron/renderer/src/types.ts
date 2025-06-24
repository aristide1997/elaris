import type { ClientToServerMessage, ServerToClientMessage, ApprovalRequestEvent } from './protocol/messages';

export type ToolStatus = 'pending_approval' | 'executing' | 'completed' | 'blocked' | 'error';

export interface ToolInstance {
  id: string;
  name: string;
  status: ToolStatus;
  timestamp: Date;
  result?: string;
}

export interface BaseMessage {
  id: string;
  timestamp: Date;
  content?: string;
  subtype?: string;
  tools?: ToolInstance[];
  status?: 'executing' | 'completed' | 'blocked';
}

export interface SystemMessage extends BaseMessage {
  type: 'system';
  content: string;
  subtype?: 'info' | 'error';
}

export interface UserMessage extends BaseMessage {
  type: 'user';
  content: string;
}

export interface AssistantMessage extends BaseMessage {
  type: 'assistant';
  content: string;
}

export interface ToolSessionMessage extends BaseMessage {
  type: 'tool_session';
  tools: ToolInstance[];
  status: 'executing' | 'completed' | 'blocked';
}

export type UIMessage = SystemMessage | UserMessage | AssistantMessage | ToolSessionMessage;

export type MCPApprovalRequest = ApprovalRequestEvent;
export type MCPServerMessage = ServerToClientMessage;
export type MCPClientMessage = ClientToServerMessage; 