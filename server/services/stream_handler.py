#!/usr/bin/env python3
"""
Stream Handler - Processes AI agent response events into WebSocket messages
"""

import logging
from typing import Dict

from pydantic_ai import Agent
from pydantic_ai.messages import (
    FinalResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPartDelta,
    ThinkingPart,
    ThinkingPartDelta,
    ToolCallPartDelta,
)

from core.messaging import WebSocketMessenger
from services.approval_service import ApprovalService

logger = logging.getLogger(__name__)

class StreamHandler:
    """Processes AI agent response events and sends WebSocket messages to client"""
    
    def __init__(self, messenger: WebSocketMessenger, approval_service: ApprovalService):
        self.messenger = messenger
        self.approval_service = approval_service
        self._sent_complete = False
    
    async def handle_stream(self, run):
        """Main entry point - process the AI agent's streaming response"""
        self._sent_complete = False
        
        try:
            async for node in run:
                logger.info(f"Processing node type: {type(node).__name__}")
                
                if Agent.is_user_prompt_node(node):
                    logger.info("Processing user prompt node")
                    
                elif Agent.is_model_request_node(node):
                    logger.info("Processing model request node")
                    await self._handle_model_request(node, run)
                    
                elif Agent.is_call_tools_node(node):
                    logger.info("Processing tool calls node")
                    await self._handle_tool_calls(node, run)
                    
                elif Agent.is_end_node(node):
                    logger.info("Processing end node - conversation complete")
                    if not self._sent_complete:
                        await self.messenger.send_assistant_complete()
                        self._sent_complete = True
                else:
                    logger.warning(f"Unknown node type: {type(node).__name__}")
                    
        except Exception as e:
            logger.error(f"Error processing agent stream: {e}", exc_info=True)
            await self.messenger.send_error(f"Error processing message: {str(e)}")
    
    async def _handle_model_request(self, node, run):
        """Process model request node and stream text/thinking responses"""
        started = False
        thinking_started = False
        
        async with node.stream(run.ctx) as request_stream:
            async for event in request_stream:
                if isinstance(event, PartStartEvent) and isinstance(event.part, ThinkingPart):
                    logger.info(f"Thinking part start: {event.part.content[:100]}...")
                    await self.messenger.send_thinking_start()
                    thinking_started = True
                    if event.part.content:
                        await self.messenger.send_thinking_delta(event.part.content)
                
                elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, ThinkingPartDelta):
                    if event.delta.content_delta:
                        await self.messenger.send_thinking_delta(event.delta.content_delta)
                
                elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                    if thinking_started:
                        await self.messenger.send_thinking_complete()
                        thinking_started = False
                    
                    if not started:
                        await self.messenger.send_assistant_start()
                        started = True
                    await self.messenger.send_text_delta(event.delta.content_delta)
                
                elif isinstance(event, PartStartEvent):
                    logger.info(f"Part start event: {event}")
                    if hasattr(event.part, 'content') and not isinstance(event.part, ThinkingPart):
                        if thinking_started:
                            await self.messenger.send_thinking_complete()
                            thinking_started = False
                        
                        if not started:
                            await self.messenger.send_assistant_start()
                            started = True
                        await self.messenger.send_text_delta(event.part.content)
                
                elif isinstance(event, FinalResultEvent):
                    logger.info(f"Final result event: {event}")
                    if thinking_started:
                        await self.messenger.send_thinking_complete()
                        thinking_started = False
        
        if thinking_started:
            await self.messenger.send_thinking_complete()
        if started:
            await self.messenger.send_assistant_complete()
            self._sent_complete = True
    
    async def _handle_tool_calls(self, node, run):
        """Process CallToolsNode - handles tool execution events"""
        tool_calls_pending = {}
        tool_session_started = False
        
        async with node.stream(run.ctx) as handle_stream:
            logger.info("Processing CallToolsNode stream...")
            async for event in handle_stream:
                logger.info(f"Received event in CallToolsNode stream: {type(event).__name__}")
                
                if isinstance(event, FunctionToolCallEvent):
                    if not tool_session_started:
                        await self.messenger.send_tool_session_start()
                        tool_session_started = True
                    await self._handle_tool_call_event(event, tool_calls_pending)
                
                elif isinstance(event, FunctionToolResultEvent):
                    await self._handle_tool_result_event(event, tool_calls_pending)
        
        if tool_session_started:
            await self.messenger.send_tool_session_complete()
    
    async def _handle_tool_call_event(self, event: FunctionToolCallEvent, tool_calls_pending: Dict):
        """Handle a function tool call event - notify UI that tool is starting"""
        tool_call_id = event.part.tool_call_id
        tool_name = event.part.tool_name
        
        tool_calls_pending[tool_call_id] = {'name': tool_name, 'started': True}
        
        await self.messenger.send_tool_start(tool_name, tool_call_id)
    
    async def _handle_tool_result_event(self, event: FunctionToolResultEvent, tool_calls_pending: Dict):
        """Handle a function tool result event - send result to UI"""
        result = event.result
        tool_call_id = event.tool_call_id
        
        if hasattr(result, 'content'):
            if isinstance(result.content, str):
                content = result.content.strip()
            else:
                content = f"Validation error: {result.content}"
            tool_name = result.tool_name or "unknown_tool"
        else:
            content = str(result).strip()
            tool_name = getattr(result, 'tool_name', 'unknown_tool')
        
        if "Tool execution denied by user" in content:
            await self.messenger.send_tool_blocked(tool_call_id, tool_name)
        else:
            if content:
                await self.messenger.send_tool_complete(tool_call_id, tool_name, content)
            else:
                await self.messenger.send_tool_complete(tool_call_id, tool_name, "Tool executed (no output)")
