#!/usr/bin/env python3
"""
Chat Session - Main orchestrator for chat conversations with AI agents
"""

import asyncio
import logging
from fastapi import WebSocket

from websocket_messenger import WebSocketMessenger
from tool_approval import ToolApprovalManager
from mcp_agent import MCPAgentManager
from message_processor import MessageStreamProcessor

logger = logging.getLogger(__name__)

class ChatSession:
    """Orchestrates a chat session with AI agent and MCP tools"""
    
    def __init__(self, websocket: WebSocket):
        """Initialize the chat session with all required components"""
        self.websocket = websocket
        
        # Initialize components
        self.messenger = WebSocketMessenger(websocket)
        self.approval_manager = ToolApprovalManager(self.messenger)
        self.agent_manager = MCPAgentManager(self.approval_manager)
        self.message_processor = MessageStreamProcessor(self.messenger, self.approval_manager)
        
        # Track active background chat tasks
        self.tasks = []
        # Ensure messages are processed sequentially per session
        self._message_lock = asyncio.Lock()
        
        # Get the configured agent
        self.agent = self.agent_manager.get_agent()
    
    async def handle_chat_message(self, user_input: str):
        """Handle a chat message from the user with streaming response"""
        async with self._message_lock:
            try:
                # Begin streaming iteration with the AI agent
                async with self.agent.iter(user_input) as run:
                    await self.message_processor.process_agent_stream(run)
            except Exception as e:
                logger.error(f"Error handling chat message: {e}", exc_info=True)
                await self.messenger.send_error(f"Error processing message: {str(e)}")
    
    async def handle_approval_response(self, approval_id: str, approved: bool):
        """Handle approval response from the client"""
        await self.approval_manager.handle_approval_response(approval_id, approved)
    
    async def send_system_ready(self, message: str = "MCP servers ready! You can start chatting."):
        """Send system ready notification to client"""
        await self.messenger.send_system_ready(message)
