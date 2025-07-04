#!/usr/bin/env python3
"""
Message Stream Processor - Handles processing of AI agent response events
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
    ToolCallPartDelta,
)

from core.messaging import WebSocketMessenger
from services.tool_approval import ToolApprovalManager

logger = logging.getLogger(__name__)

class MessageStreamProcessor:
    """Processes AI agent response events and coordinates with other components"""
    
    def __init__(self, messenger: WebSocketMessenger, approval_manager: ToolApprovalManager):
        self.messenger = messenger
        self.approval_manager = approval_manager
    
    async def process_agent_stream(self, run):
        """Process the AI agent's streaming response"""
        # Reset completion flag for this stream run
        self._sent_complete = False
        try:
            async for node in run:
                logger.info(f"Processing node type: {type(node).__name__}")
                
                if Agent.is_user_prompt_node(node):
                    # User prompt - already handled
                    logger.info("Processing user prompt node")
                    pass
                    
                elif Agent.is_model_request_node(node):
                    # Process model response node (bubble inside stream)
                    logger.info("Processing model request node")
                    await self._process_model_request(node, run)
                    
                elif Agent.is_call_tools_node(node):
                    # Handle tool calls with approval
                    logger.info("Processing tool calls node")
                    await self._process_tool_calls(node, run)
                    
                elif Agent.is_end_node(node):
                    # Final completion
                    logger.info("Processing end node - conversation complete")
                    # Only send final complete if not already sent during model streaming
                    if not getattr(self, '_sent_complete', False):
                        await self.messenger.send_assistant_complete()
                        self._sent_complete = True
                else:
                    logger.warning(f"Unknown node type: {type(node).__name__}")
                    
        except Exception as e:
            logger.error(f"Error processing agent stream: {e}", exc_info=True)
            await self.messenger.send_error(f"Error processing message: {str(e)}")
    
    async def _process_model_request(self, node, run):
        """Process model request node and stream text responses"""
        started = False
        async with node.stream(run.ctx) as request_stream:
            async for event in request_stream:
                # Only open a bubble when actual text arrives
                if isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                    if not started:
                        await self.messenger.send_assistant_start()
                        started = True
                    # Stream text to client
                    await self.messenger.send_text_delta(event.delta.content_delta)
                elif isinstance(event, PartStartEvent):
                    logger.info(f"Part start event: {event}")
                elif isinstance(event, FinalResultEvent):
                    logger.info(f"Final result event: {event}")
        # Close the bubble if we opened one
        if started:
            await self.messenger.send_assistant_complete()
            # Mark that we've sent a completion for this run
            self._sent_complete = True
    
    async def _process_tool_calls(self, node, run):
        """Process CallToolsNode - this handles both tool calls AND text-only responses"""
        tool_calls_pending = {}
        tool_session_started = False
        
        async with node.stream(run.ctx) as handle_stream:
            logger.info("Processing CallToolsNode stream...")
            async for event in handle_stream:
                logger.info(f"Received event in CallToolsNode stream: {type(event).__name__}")
                
                if isinstance(event, FunctionToolCallEvent):
                    # First tool call event - start tool session
                    if not tool_session_started:
                        await self.messenger.send_tool_session_start()
                        tool_session_started = True
                    await self._handle_tool_call_event(event, tool_calls_pending)
                
                elif isinstance(event, FunctionToolResultEvent):
                    await self._handle_tool_result_event(event, tool_calls_pending)
        
        # Complete tool session if we started one
        if tool_session_started:
            await self.messenger.send_tool_session_complete()
        # If no tool events were yielded, this was a text-only response - no tool session needed
    
    async def _handle_tool_call_event(self, event: FunctionToolCallEvent, tool_calls_pending: Dict):
        """Handle a function tool call event - notify UI that tool is starting"""
        tool_call_id = event.part.tool_call_id
        tool_name = event.part.tool_name
        
        # Mark this tool call as pending
        tool_calls_pending[tool_call_id] = {'name': tool_name, 'started': True}
        
        # Use new graph-aligned event with tool ID
        await self.messenger.send_tool_start(tool_name, tool_call_id)
    
    async def _handle_tool_result_event(self, event: FunctionToolResultEvent, tool_calls_pending: Dict):
        """Handle a function tool result event - send result to UI based on content"""
        result = event.result
        tool_call_id = event.tool_call_id
        
        # Handle both ToolReturnPart and RetryPromptPart
        if hasattr(result, 'content'):
            if isinstance(result.content, str):
                content = result.content.strip()
            else:
                # Handle validation errors (list of ErrorDetails)
                content = f"Validation error: {result.content}"
            tool_name = result.tool_name or "unknown_tool"
        else:
            content = str(result).strip()
            tool_name = getattr(result, 'tool_name', 'unknown_tool')
        
        # Only differentiate blocked tools, treat errors and successes the same
        if "Tool execution denied by user" in content:
            await self.messenger.send_tool_blocked(tool_call_id, tool_name)
        else:
            # All tool executions (success or error) are treated the same
            if content:
                await self.messenger.send_tool_complete(tool_call_id, tool_name, content)
            else:
                await self.messenger.send_tool_complete(tool_call_id, tool_name, "Tool executed (no output)")
