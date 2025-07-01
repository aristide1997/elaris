#!/usr/bin/env python3
"""
Conversation Database - SQLite database for storing chat conversations
"""

import aiosqlite
import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

from pydantic_ai.messages import ModelMessagesTypeAdapter

logger = logging.getLogger(__name__)

# Database file path
DB_FILE = "conversations.db"

async def init_db():
    """Initialize the database with required tables"""
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            conversation_id TEXT PRIMARY KEY,
            user_id TEXT,
            messages JSON,
            usage_stats JSON,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
        )
        ''')
        await db.commit()
        logger.info("Database initialized")

async def save_conversation(conversation_id: str, all_messages: list, usage: Any, user_id: Optional[str] = None) -> str:
    """
    Save a complete conversation (called only after agent run completes)
    Returns the conversation ID
    """
    current_time = datetime.now().isoformat()
    
    # Serialize messages using the pydantic-ai adapter
    messages_json = ModelMessagesTypeAdapter.dump_json(all_messages).decode('utf-8')
    
    # Convert usage object to dict
    # Handle usage as a function which needs to be called
    usage_data = usage() if callable(usage) else usage
    usage_dict = {
        "total_tokens": usage_data.total_tokens,
        "request_tokens": usage_data.request_tokens,
        "response_tokens": usage_data.response_tokens,
        "requests": usage_data.requests
    }
    
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute(
            '''
            INSERT INTO conversations 
            (conversation_id, user_id, messages, usage_stats, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?)
            ''', 
            (conversation_id, user_id, messages_json, json.dumps(usage_dict), current_time, current_time)
        )
        await db.commit()
        logger.info(f"Saved new conversation {conversation_id} with {len(all_messages)} messages")
        return conversation_id

async def update_conversation(conversation_id: str, all_messages: list, usage: Any):
    """
    Update an existing conversation with complete message history and usage stats
    """
    current_time = datetime.now().isoformat()
    
    # Serialize messages using the pydantic-ai adapter
    messages_json = ModelMessagesTypeAdapter.dump_json(all_messages).decode('utf-8')
    
    # Convert usage object to dict
    # Handle usage as a function which needs to be called
    usage_data = usage() if callable(usage) else usage
    usage_dict = {
        "total_tokens": usage_data.total_tokens,
        "request_tokens": usage_data.request_tokens,
        "response_tokens": usage_data.response_tokens,
        "requests": usage_data.requests
    }
    
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute(
            '''
            UPDATE conversations 
            SET messages = ?, usage_stats = ?, updated_at = ?
            WHERE conversation_id = ?
            ''',
            (messages_json, json.dumps(usage_dict), current_time, conversation_id)
        )
        await db.commit()
        logger.info(f"Updated conversation {conversation_id} with complete history")

async def get_conversation_by_id(conversation_id: str) -> Optional[Dict]:
    """
    Get a specific conversation by ID
    """
    async with aiosqlite.connect(DB_FILE) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM conversations WHERE conversation_id = ?", (conversation_id,))
        row = await cursor.fetchone()
        
        if row:
            conversation = dict(row)
            # Deserialize messages into ModelMessage objects
            conversation['messages'] = ModelMessagesTypeAdapter.validate_json(conversation['messages'])
            if conversation['usage_stats']:
                conversation['usage_stats'] = json.loads(conversation['usage_stats'])
            return conversation
        return None

async def get_conversation_history(limit: int = 10) -> List[Dict]:
    """
    Retrieve conversation history for a session
    Returns list of conversations sorted by updated_at (newest first)
    """
    async with aiosqlite.connect(DB_FILE) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            '''
            SELECT * FROM conversations 
            ORDER BY updated_at DESC
            LIMIT ?
            ''',
            (limit,)
        )
        rows = await cursor.fetchall()
        
        conversations = []
        for row in rows:
            conversation = dict(row)
            # Deserialize messages into ModelMessage objects
            conversation['messages'] = ModelMessagesTypeAdapter.validate_json(conversation['messages'])
            if conversation['usage_stats']:
                conversation['usage_stats'] = json.loads(conversation['usage_stats'])
            conversations.append(conversation)
            
        return conversations

async def get_latest_conversation_messages() -> Optional[list]:
    """
    Get the messages from the most recent conversation
    """
    conversations = await get_conversation_history(limit=1)
    if conversations:
        # messages is already a list[ModelMessage]
        return conversations[0]['messages']
    return None

async def delete_conversation(conversation_id: str) -> bool:
    """
    Delete a conversation by ID
    Returns True if successful
    """
    async with aiosqlite.connect(DB_FILE) as db:
        await db.execute("DELETE FROM conversations WHERE conversation_id = ?", (conversation_id,))
        await db.commit()
        logger.info(f"Deleted conversation {conversation_id}")
        return True
