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

from websocket_messenger import WebSocketMessenger
from tool_approval import ToolApprovalManager

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
        """Process tool calls with approval workflow"""
        tool_calls_pending = {}
        
        async with node.stream(run.ctx) as handle_stream:
            logger.info("Starting to iterate through tool call events...")
            async for event in handle_stream:
                logger.info(f"Received event in tool calls stream: {type(event).__name__}")
                
                if isinstance(event, FunctionToolCallEvent):
                    await self._handle_tool_call_event(event, tool_calls_pending)
                
                elif isinstance(event, FunctionToolResultEvent):
                    await self._handle_tool_result_event(event, tool_calls_pending)
    
    async def _handle_tool_call_event(self, event: FunctionToolCallEvent, tool_calls_pending: Dict):
        """Handle a function tool call event - notify UI that tool is starting"""
        tool_call_id = event.part.tool_call_id
        tool_name = event.part.tool_name
        
        # Mark this tool call as pending
        tool_calls_pending[tool_call_id] = True
        
        # Notify UI that tool is executing
        await self.messenger.send_tool_executing(tool_name)
    
    async def _handle_tool_result_event(self, event: FunctionToolResultEvent, tool_calls_pending: Dict):
        """Handle a function tool result event - send result to UI based on content"""
        result = event.result  # Fix: use .result not .part
        
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
        
        # Handle different result types based on content
        if "Tool execution denied by user" in content:
            await self.messenger.send_tool_blocked(tool_name)
            await self.messenger.send_tool_result_blocked()
        elif "Tool execution error:" in content:
            await self.messenger.send_error(content)
        else:
            # Successful tool execution
            if content:
                await self.messenger.send_tool_result(content)
            else:
                await self.messenger.send_tool_result("Tool executed successfully (no output)")
