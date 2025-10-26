#!/usr/bin/env python3
"""
Conversation Repository - Handles all database operations for conversations
"""

import logging
from typing import Optional, List, Any
from datetime import datetime

from core.database import (
    get_conversation_by_id as db_get_conversation,
    save_conversation as db_save_conversation,
    update_conversation as db_update_conversation,
    delete_conversation as db_delete_conversation,
    get_conversation_history as db_get_conversation_history
)

logger = logging.getLogger(__name__)

class ConversationRepository:
    """Repository pattern for conversation database operations"""
    
    async def get_conversation(self, conversation_id: str) -> Optional[dict]:
        """Get a conversation by ID"""
        return await db_get_conversation(conversation_id)
    
    async def save_new_conversation(self, conversation_id: str, messages: list, usage: Any, user_id: Optional[str] = None) -> str:
        """Save a new conversation"""
        return await db_save_conversation(conversation_id, messages, usage, user_id)
    
    async def update_conversation(self, conversation_id: str, messages: list, usage: Any):
        """Update an existing conversation"""
        await db_update_conversation(conversation_id, messages, usage)
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation"""
        return await db_delete_conversation(conversation_id)
    
    async def get_conversation_history(self, limit: int = 10) -> List[dict]:
        """Get conversation history"""
        return await db_get_conversation_history(limit)
    
    async def get_messages_before_index(self, conversation_id: str, message_index: int) -> Optional[list]:
        """Get messages from a conversation up to (but not including) a specific index"""
        conversation = await self.get_conversation(conversation_id)
        if not conversation:
            return None
        
        messages = conversation['messages']
        if message_index > len(messages):
            logger.warning(f"Message index {message_index} exceeds conversation length {len(messages)}")
            return messages
        
        return messages[:message_index]
