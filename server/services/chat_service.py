#!/usr/bin/env python3
"""
Chat Session - Main orchestrator for chat conversations with AI agents
"""

import asyncio
import logging
import base64
from fastapi import WebSocket

from core.messaging import WebSocketMessenger
from services.tool_approval import ToolApprovalManager
from services.mcp_agent import MCPAgentManager
from services.message_processor import MessageStreamProcessor
from core.database import get_conversation_by_id, save_conversation, update_conversation
from pydantic_ai.messages import ModelRequest, Usage, UserPromptPart, BinaryContent

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
    
    async def handle_chat_message(self, user_input: str, conversation_id: str, images=None):
        """Handle a chat message from the user with streaming response"""
        async with self._message_lock:
            try:
                # Fetch previous messages if the conversation exists
                conversation = await get_conversation_by_id(conversation_id)
                if conversation:
                    existing_messages = conversation['messages']
                    logger.info(f"Continuing conversation {conversation_id} with {len(existing_messages)} messages")
                else:
                    existing_messages = []
                    logger.info(f"Starting new conversation {conversation_id}")
                
                # Prepare content for agent iteration
                if images and len(images) > 0:
                    # Process images into pydantic-ai format
                    content_parts = []
                    
                    if user_input.strip():
                        content_parts.append(user_input)
                    
                    # Convert images to BinaryContent
                    for img_data in images:
                        try:
                            image_bytes = base64.b64decode(img_data['data'])
                            binary_content = BinaryContent(
                                data=image_bytes,
                                media_type=img_data['mediaType']
                            )
                            content_parts.append(binary_content)
                            logger.info(f"Added image: {img_data['name']} ({img_data['mediaType']}, {len(image_bytes)} bytes)")
                        except Exception as e:
                            logger.error(f"Error processing image {img_data.get('name', 'unknown')}: {e}")
                            await self.messenger.send_error(f"Error processing image: {str(e)}")
                            return
                    
                    # Use content_parts directly for agent.iter()
                    user_content = content_parts
                else:
                    # Text-only message
                    user_content = user_input
                
                # Prepare message history for agent iteration
                message_history = existing_messages if existing_messages else None

                # Create a fresh agent for this message with current enabled servers
                agent = await self.agent_manager.create_agent()
                
                # Begin streaming iteration with the AI agent
                async with agent.iter(user_content, message_history=message_history) as run:
                    await self.message_processor.process_agent_stream(run)
                    
                    # After stream completes, save or update the conversation
                    await self._save_conversation(run.result, conversation_id)
                    
            except RuntimeError as e:
                # Handle model capability errors (e.g., images not supported)
                if "support" in str(e).lower():
                    logger.warning(f"Model capability error: {e}")
                    await self.messenger.send_error(f"This model doesn't support images: {str(e)}")
                else:
                    logger.error(f"Runtime error handling chat message: {e}", exc_info=True)
                    await self.messenger.send_error(f"Error processing message: {str(e)}")
            except NotImplementedError as e:
                logger.warning(f"Feature not implemented: {e}")
                await self.messenger.send_error(f"Image type not supported: {str(e)}")
            except asyncio.CancelledError:
                # Task was cancelled by user stop request - swallow without error
                logger.info(f"Chat message handling cancelled for conversation {conversation_id}")
                return
            except Exception as e:
                logger.error(f"Error handling chat message: {e}", exc_info=True)
                await self.messenger.send_error(f"Error processing message: {str(e)}")
    
    async def _save_conversation(self, result, conversation_id: str):
        """Save or update the conversation to database based on conversation_id"""
        try:
            # Get all messages (complete conversation history)
            all_messages = result.all_messages()
            # Check if this conversation already exists
            existing = await get_conversation_by_id(conversation_id)
            if existing:
                await update_conversation(conversation_id, all_messages, result.usage)
                # Get token count for logging
                usage_data = result.usage() if callable(result.usage) else result.usage
                token_count = getattr(usage_data, "total_tokens", "Unknown")
                logger.info(f"Updated conversation {conversation_id} - "
                            f"Messages: {len(all_messages)}, "
                            f"Usage: {token_count} tokens")
            else:
                await save_conversation(
                    conversation_id,
                    all_messages,
                    result.usage
                )
                # Get token count for logging
                usage_data = result.usage() if callable(result.usage) else result.usage
                token_count = getattr(usage_data, "total_tokens", "Unknown")
                logger.info(f"Saved new conversation {conversation_id} - "
                            f"Messages: {len(all_messages)}, "
                            f"Usage: {token_count} tokens")
            return conversation_id
        except Exception as e:
            logger.error(f"Error saving conversation: {e}", exc_info=True)
            return None
    
    async def handle_edit_user_message(self, conversation_id: str, user_message_index: int, new_content: str):
        """Handle editing a user message and re-running the conversation from that point"""
        async with self._message_lock:
            try:
                # Load the existing conversation
                conversation = await get_conversation_by_id(conversation_id)
                if not conversation:
                    logger.error(f"Conversation {conversation_id} not found for editing")
                    await self.messenger.send_error("Conversation not found")
                    return
                
                messages = conversation['messages']
                logger.info(f"Editing conversation {conversation_id} with {len(messages)} messages")
                
                # Find the user message at the specified index
                user_count = 0
                edit_position = None
                
                for i, message in enumerate(messages):
                    if message.kind == 'request':  # User message in pydantic-ai
                        if user_count == user_message_index:
                            edit_position = i
                            break
                        user_count += 1
                
                if edit_position is None:
                    logger.error(f"User message at index {user_message_index} not found")
                    await self.messenger.send_error(f"User message at index {user_message_index} not found")
                    return
                
                # Truncate conversation history up to (but not including) the edit position
                messages_up_to_edit = messages[:edit_position]
                logger.info(f"Truncating conversation to {len(messages_up_to_edit)} messages before edit point")
                
                # Prepare message history for agent iteration (None if empty)
                message_history = messages_up_to_edit if messages_up_to_edit else None
                
                # Create a fresh agent for this edited message
                agent = await self.agent_manager.create_agent()
                
                # Begin streaming iteration with the AI agent using the new content
                async with agent.iter(new_content, message_history=message_history) as run:
                    await self.message_processor.process_agent_stream(run)
                    
                    # After stream completes, save the updated conversation
                    await self._save_conversation(run.result, conversation_id)
                    
                logger.info(f"Successfully processed edit for conversation {conversation_id}")
                    
            except asyncio.CancelledError:
                # Task was cancelled by user stop request - swallow without error
                logger.info(f"Edit message handling cancelled for conversation {conversation_id}")
                return
            except Exception as e:
                logger.error(f"Error handling edit message: {e}", exc_info=True)
                await self.messenger.send_error(f"Error processing edit: {str(e)}")
    
    async def handle_approval_response(self, approval_id: str, approved: bool):
        """Handle approval response from the client"""
        await self.approval_manager.handle_approval_response(approval_id, approved)
    
    async def send_system_ready(self, message: str = "MCP servers ready! You can start chatting."):
        """Send system ready notification to client"""
        await self.messenger.send_system_ready(message)
    
    async def cleanup(self):
        """Cleanup chat session resources"""
        # Cancel any pending tasks
        for task in self.tasks:
            if not task.done():
                task.cancel()
        
        # Wait for tasks to finish cancelling
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        
        logger.info("Chat session cleanup completed")
