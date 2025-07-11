#!/usr/bin/env python3
"""
WebSocket Messenger - Handles all WebSocket communication for the chat application
"""

import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class WebSocketMessenger:
    """Handles WebSocket communication with the client"""
    
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
    
    async def send_message(self, message_type: str, **data):
        """Send a message to the WebSocket client"""
        try:
            await self.websocket.send_json({
                "type": message_type,
                **data
            })
        except Exception as e:
            logger.error(f"Failed to send WebSocket message: {e}")
    
    async def send_system_ready(self, message: str):
        """Send system ready notification"""
        await self.send_message("system_ready", message=message)
    
    async def send_assistant_start(self):
        """Signal start of assistant response"""
        await self.send_message("assistant_start")
    
    async def send_assistant_complete(self):
        """Signal completion of assistant response"""
        await self.send_message("assistant_complete")
    
    async def send_text_delta(self, content: str):
        """Send streaming text content"""
        await self.send_message("text_delta", content=content)
    
    # Thinking events
    async def send_thinking_start(self):
        """Signal start of thinking phase"""
        await self.send_message("thinking_start")
    
    async def send_thinking_delta(self, content: str):
        """Send streaming thinking content"""
        await self.send_message("thinking_delta", content=content)
    
    async def send_thinking_complete(self):
        """Signal completion of thinking phase"""
        await self.send_message("thinking_complete")
    
    # Tool execution phase events (new graph-aligned events)
    async def send_tool_session_start(self):
        """Signal start of tool execution phase (CallToolsNode)"""
        await self.send_message("tool_session_start")
    
    async def send_tool_session_complete(self):
        """Signal completion of tool execution phase"""
        await self.send_message("tool_session_complete")
    
    async def send_tool_start(self, tool_name: str, tool_id: str):
        """Signal individual tool execution start"""
        await self.send_message("tool_start", tool_name=tool_name, tool_id=tool_id)
    
    async def send_tool_complete(self, tool_id: str, tool_name: str, content: str):
        """Signal individual tool execution completion"""
        await self.send_message("tool_complete", tool_id=tool_id, tool_name=tool_name, content=content)
    
    async def send_tool_blocked(self, tool_id: str, tool_name: str):
        """Signal individual tool was blocked"""
        await self.send_message("tool_blocked", tool_id=tool_id, tool_name=tool_name)
    
    async def send_error(self, message: str):
        """Send error message"""
        await self.send_message("error", message=message)
