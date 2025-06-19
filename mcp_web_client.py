#!/usr/bin/env python3
"""
MCP Web Client - WebSocket-based version of the CLI client
Handles streaming responses and tool approval via WebSocket
"""

import asyncio
import uuid
import logging
from typing import Dict
from fastapi import WebSocket

from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio
from pydantic_ai.messages import (
    FinalResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPartDelta,
    ToolCallPartDelta,
)

logger = logging.getLogger(__name__)

class MCPWebClient:
    def __init__(self, websocket: WebSocket):
        """Initialize the MCP Web Client with WebSocket connection"""
        self.websocket = websocket
        
        # Initialize MCP server - same as CLI version
        self.server = MCPServerStdio(
            'npx',
            args=[
                '-y',
                '@wonderwhy-er/desktop-commander',
                'stdio',
            ]
        )
        self.agent = Agent('openai:gpt-4.1-mini', mcp_servers=[self.server])
        
        # Track pending approvals
        self.pending_approvals: Dict[str, asyncio.Future] = {}
    
    async def send_message(self, message_type: str, **data):
        """Send a message to the WebSocket client"""
        try:
            await self.websocket.send_json({
                "type": message_type,
                **data
            })
        except Exception as e:
            logger.error(f"Failed to send WebSocket message: {e}")
    
    async def get_user_approval(self, tool_name: str, args: dict) -> bool:
        """Ask user for approval to execute a tool call via WebSocket"""
        approval_id = str(uuid.uuid4())
        
        logger.info(f"Requesting approval for tool: {tool_name} with ID: {approval_id}")
        
        # Send approval request to client
        await self.send_message(
            "approval_request",
            approval_id=approval_id,
            tool_name=tool_name,
            args=args
        )
        
        # Create a future to wait for the response
        loop = asyncio.get_running_loop()
        approval_future = loop.create_future()
        self.pending_approvals[approval_id] = approval_future
        
        try:
            # Wait for approval response with timeout
            approved = await asyncio.wait_for(approval_future, timeout=60.0)  # 60 second timeout
            logger.info(f"Approval received for {approval_id}: {approved}")
            return approved
        except asyncio.TimeoutError:
            logger.error(f"Approval timeout for tool: {tool_name}")
            return False
        except Exception as e:
            logger.error(f"Error waiting for approval: {e}")
            return False
        finally:
            # Clean up
            self.pending_approvals.pop(approval_id, None)
    
    async def handle_approval_response(self, approval_id: str, approved: bool):
        """Handle approval response from the client"""
        logger.info(f"Received approval response for {approval_id}: {approved}")
        
        if approval_id in self.pending_approvals:
            future = self.pending_approvals[approval_id]
            if not future.done():
                future.set_result(approved)
                logger.info(f"Successfully set approval result for {approval_id}")
            else:
                logger.warning(f"Future already done for approval ID: {approval_id}")
        else:
            logger.warning(f"Received approval response for unknown ID: {approval_id}")
            logger.info(f"Current pending approvals: {list(self.pending_approvals.keys())}")
    
    async def handle_chat_message(self, user_input: str):
        """Handle a chat message from the user with streaming response"""
        try:
            await self.send_message("assistant_start")
            
            # Begin streaming iteration - adapted from CLI version
            async with self.agent.iter(user_input) as run:
                async for node in run:
                    logger.info(f"Processing node type: {type(node).__name__}")
                    
                    if Agent.is_user_prompt_node(node):
                        # User prompt - already handled
                        logger.info("Processing user prompt node")
                        pass
                        
                    elif Agent.is_model_request_node(node):
                        # Stream the model's response
                        logger.info("Processing model request node")
                        async with node.stream(run.ctx) as request_stream:
                            async for event in request_stream:
                                if isinstance(event, PartDeltaEvent):
                                    if isinstance(event.delta, TextPartDelta):
                                        # Stream text to client
                                        await self.send_message(
                                            "text_delta",
                                            content=event.delta.content_delta
                                        )
                                elif isinstance(event, PartStartEvent):
                                    logger.info(f"Part start event: {event}")
                                elif isinstance(event, FinalResultEvent):
                                    logger.info(f"Final result event: {event}")
                                    
                    elif Agent.is_call_tools_node(node):
                        # Handle tool calls with approval
                        logger.info("Processing tool calls node")
                        tool_calls_pending = {}
                        
                        async with node.stream(run.ctx) as handle_stream:
                            logger.info("Starting to iterate through tool call events...")
                            async for event in handle_stream:
                                logger.info(f"Received event in tool calls stream: {type(event).__name__}")
                                if isinstance(event, FunctionToolCallEvent):
                                    tool_name = event.part.tool_name
                                    args = event.part.args
                                    tool_call_id = event.part.tool_call_id
                                    
                                    logger.info(f"Tool call requested: {tool_name} with args: {args}")
                                    
                                    # Get user approval
                                    logger.info("Requesting user approval...")
                                    approved = await self.get_user_approval(tool_name, args)
                                    tool_calls_pending[tool_call_id] = approved
                                    
                                    logger.info(f"Tool {tool_name} approval result: {approved}")
                                    
                                    if approved:
                                        logger.info(f"Tool {tool_name} was approved, sending executing message")
                                        await self.send_message(
                                            "tool_executing",
                                            tool_name=tool_name
                                        )
                                    else:
                                        logger.info(f"Tool {tool_name} was denied, sending blocked message")
                                        await self.send_message(
                                            "tool_blocked",
                                            tool_name=tool_name
                                        )
                                    
                                    logger.info(f"Finished processing FunctionToolCallEvent for {tool_name}")
                                
                                elif isinstance(event, FunctionToolResultEvent):
                                    tool_call_id = event.tool_call_id
                                    was_approved = tool_calls_pending.get(tool_call_id, False)
                                    
                                    logger.info(f"Tool result received for {tool_call_id}, was_approved: {was_approved}")
                                    
                                    if was_approved:
                                        try:
                                            result_content = str(event.result.content).strip()
                                            logger.info(f"Tool result content length: {len(result_content)}")
                                            
                                            if result_content:
                                                await self.send_message(
                                                    "tool_result",
                                                    content=result_content
                                                )
                                            else:
                                                await self.send_message(
                                                    "tool_result",
                                                    content="Tool executed successfully (no output)"
                                                )
                                        except Exception as e:
                                            logger.error(f"Error processing tool result: {e}")
                                            await self.send_message(
                                                "tool_result",
                                                content=f"Tool executed but error processing result: {str(e)}"
                                            )
                                    else:
                                        await self.send_message(
                                            "tool_result_blocked"
                                        )
                                        
                    elif Agent.is_end_node(node):
                        # Final completion
                        logger.info("Processing end node - conversation complete")
                        await self.send_message("assistant_complete")
                    else:
                        logger.warning(f"Unknown node type: {type(node).__name__}")
                        
        except Exception as e:
            logger.error(f"Error handling chat message: {e}", exc_info=True)
            await self.send_message(
                "error",
                message=f"Error processing message: {str(e)}"
            )
