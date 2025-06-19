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
    
    async def send_tool_executing(self, tool_name: str):
        """Notify that a tool is being executed"""
        await self.send_message("tool_executing", tool_name=tool_name)
    
    async def send_tool_blocked(self, tool_name: str):
        """Notify that a tool was blocked"""
        await self.send_message("tool_blocked", tool_name=tool_name)
    
    async def send_tool_result(self, content: str):
        """Send tool execution result"""
        await self.send_message("tool_result", content=content)
    
    async def send_tool_result_blocked(self):
        """Notify that tool result was blocked"""
        await self.send_message("tool_result_blocked")
    
    async def send_error(self, message: str):
        """Send error message"""
        await self.send_message("error", message=message)
