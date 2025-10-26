#!/usr/bin/env python3
"""
Conversation Orchestrator - Coordinates conversation flow between services
"""

import asyncio
import logging
import base64

from core.messaging import WebSocketMessenger
from services.conversation_repository import ConversationRepository
from services.agent_factory import AgentFactory
from services.stream_handler import StreamHandler
from services.approval_service import ApprovalService
from pydantic_ai.messages import BinaryContent

logger = logging.getLogger(__name__)

class ConversationOrchestrator:
    """Orchestrates conversation flow by coordinating specialized services"""
    
    def __init__(
        self,
        messenger: WebSocketMessenger,
        repository: ConversationRepository,
        agent_factory: AgentFactory,
        stream_handler: StreamHandler,
        approval_service: ApprovalService
    ):
        self.messenger = messenger
        self.repository = repository
        self.agent_factory = agent_factory
        self.stream_handler = stream_handler
        self.approval_service = approval_service
        
        self.tasks = []
        self._message_lock = asyncio.Lock()
    
    async def handle_chat_message(self, user_input: str, conversation_id: str, images=None):
        """Handle a chat message from the user with streaming response"""
        async with self._message_lock:
            try:
                conversation = await self.repository.get_conversation(conversation_id)
                if conversation:
                    existing_messages = conversation['messages']
                    logger.info(f"Continuing conversation {conversation_id} with {len(existing_messages)} messages")
                else:
                    existing_messages = []
                    logger.info(f"Starting new conversation {conversation_id}")
                
                user_content = self._prepare_user_content(user_input, images)
                message_history = existing_messages if existing_messages else None
                
                agent = await self.agent_factory.create_agent(self.approval_service)
                
                async with agent.iter(user_content, message_history=message_history) as run:
                    await self.stream_handler.handle_stream(run)
                    await self._save_conversation_result(run.result, conversation_id)
                    
            except RuntimeError as e:
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
                logger.info(f"Chat message handling cancelled for conversation {conversation_id}")
                return
            except Exception as e:
                logger.error(f"Error handling chat message: {e}", exc_info=True)
                await self.messenger.send_error(f"Error processing message: {str(e)}")
    
    async def handle_edit_message(self, conversation_id: str, user_message_index: int, new_content: str):
        """Handle editing a user message and re-running the conversation from that point"""
        async with self._message_lock:
            try:
                conversation = await self.repository.get_conversation(conversation_id)
                if not conversation:
                    logger.error(f"Conversation {conversation_id} not found for editing")
                    await self.messenger.send_error("Conversation not found")
                    return
                
                messages = conversation['messages']
                logger.info(f"Editing conversation {conversation_id} with {len(messages)} messages")
                
                edit_position = self._find_user_message_position(messages, user_message_index)
                if edit_position is None:
                    logger.error(f"User message at index {user_message_index} not found")
                    await self.messenger.send_error(f"User message at index {user_message_index} not found")
                    return
                
                messages_up_to_edit = messages[:edit_position]
                logger.info(f"Truncating conversation to {len(messages_up_to_edit)} messages before edit point")
                
                message_history = messages_up_to_edit if messages_up_to_edit else None
                
                agent = await self.agent_factory.create_agent(self.approval_service)
                
                async with agent.iter(new_content, message_history=message_history) as run:
                    await self.stream_handler.handle_stream(run)
                    await self._save_conversation_result(run.result, conversation_id)
                    
                logger.info(f"Successfully processed edit for conversation {conversation_id}")
                    
            except asyncio.CancelledError:
                logger.info(f"Edit message handling cancelled for conversation {conversation_id}")
                return
            except Exception as e:
                logger.error(f"Error handling edit message: {e}", exc_info=True)
                await self.messenger.send_error(f"Error processing edit: {str(e)}")
    
    async def handle_approval_response(self, approval_id: str, approved: bool):
        """Handle approval response from the client"""
        await self.approval_service.handle_approval_response(approval_id, approved)
    
    async def send_ready(self, message: str = "MCP servers ready! You can start chatting."):
        """Send system ready notification to client"""
        await self.messenger.send_system_ready(message)
    
    async def cleanup(self):
        """Cleanup orchestrator resources"""
        for task in self.tasks:
            if not task.done():
                task.cancel()
        
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        
        logger.info("Conversation orchestrator cleanup completed")
    
    def _prepare_user_content(self, user_input: str, images=None):
        """Prepare user content with text and images for agent iteration"""
        if images and len(images) > 0:
            content_parts = []
            
            if user_input.strip():
                content_parts.append(user_input)
            
            for img_data in images:
                try:
                    image_bytes = base64.b64decode(img_data['data'])
                    binary_content = BinaryContent(
                        data=image_bytes,
                        media_type=img_data['media_type']
                    )
                    content_parts.append(binary_content)
                    logger.info(f"Added image: {img_data['name']} ({img_data['media_type']}, {len(image_bytes)} bytes)")
                except Exception as e:
                    logger.error(f"Error processing image {img_data.get('name', 'unknown')}: {e}")
                    raise
            
            return content_parts
        else:
            return user_input
    
    async def _save_conversation_result(self, result, conversation_id: str):
        """Save or update the conversation to database"""
        try:
            all_messages = result.all_messages()
            existing = await self.repository.get_conversation(conversation_id)
            
            if existing:
                await self.repository.update_conversation(conversation_id, all_messages, result.usage)
                usage_data = result.usage() if callable(result.usage) else result.usage
                token_count = getattr(usage_data, "total_tokens", "Unknown")
                logger.info(f"Updated conversation {conversation_id} - Messages: {len(all_messages)}, Usage: {token_count} tokens")
            else:
                await self.repository.save_new_conversation(conversation_id, all_messages, result.usage)
                usage_data = result.usage() if callable(result.usage) else result.usage
                token_count = getattr(usage_data, "total_tokens", "Unknown")
                logger.info(f"Saved new conversation {conversation_id} - Messages: {len(all_messages)}, Usage: {token_count} tokens")
        except Exception as e:
            logger.error(f"Error saving conversation: {e}", exc_info=True)
    
    def _find_user_message_position(self, messages, user_message_index: int):
        """Find the position of a user message in the message list"""
        user_count = 0
        
        for i, message in enumerate(messages):
            if message.kind == 'request':
                if any(part.part_kind == 'user-prompt' for part in message.parts):
                    if user_count == user_message_index:
                        return i
                    user_count += 1
        
        return None
