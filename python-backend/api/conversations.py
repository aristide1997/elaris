#!/usr/bin/env python3
"""
Conversation API Router - REST endpoints for conversation management
"""

from fastapi import APIRouter, HTTPException
from uuid import uuid4
from types import SimpleNamespace
import logging

from core.database import get_conversation_history, get_conversation_by_id, delete_conversation, save_conversation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

def _truncate_preview(text: str, max_words: int = 4) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]) + "..."

def _get_first_user_message(messages: list) -> str:
    for msg in messages:
        # Handle objects with parts attribute (ModelRequest, ModelResponse)
        parts = getattr(msg, "parts", None)
        if parts:
            for part in parts:
                if getattr(part, "part_kind", None) == "user-prompt":
                    content = getattr(part, "content", "")
                    # Return string content directly
                    if isinstance(content, str):
                        return content
                    # Flatten list content if necessary
                    if isinstance(content, (list, tuple)):
                        fragments: list[str] = []
                        for item in content:
                            if isinstance(item, str):
                                fragments.append(item)
                            elif isinstance(item, dict) and "content" in item:
                                fragments.append(str(item["content"]))
                        return " ".join(fragments)
        # Fallback for raw dict messages
        if isinstance(msg, dict) and msg.get("type") == "user_prompt":
            return msg.get("content", "")
    return ""

@router.get("")
async def list_conversations(limit: int = 10):
    """Get conversation history"""
    try:
        conversations = await get_conversation_history(limit)
        return {
            "status": "success",
            "conversations": [
                {
                    "conversation_id": conv["conversation_id"],
                    "created_at": conv["created_at"],
                    "updated_at": conv["updated_at"],
                    "message_count": len(conv["messages"]),
                    # Include first user message as preview
                    "preview": _truncate_preview(_get_first_user_message(conv["messages"]))
                }
                for conv in conversations
            ]
        }
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get a specific conversation by ID"""
    conversation = await get_conversation_by_id(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail=f"Conversation {conversation_id} not found")
    return {
        "status": "success",
        "conversation": conversation
    }

@router.delete("/{conversation_id}")
async def delete_conversation_by_id(conversation_id: str):
    """Delete a specific conversation by ID"""
    success = await delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Conversation {conversation_id} not found")
    return {
        "status": "success",
        "message": f"Conversation {conversation_id} deleted"
    }

@router.post("")
async def create_conversation():
    """Create a new empty conversation stub"""
    new_id = str(uuid4())
    usage = SimpleNamespace(total_tokens=0, request_tokens=0, response_tokens=0, requests=0)
    await save_conversation(new_id, [], usage)
    return {"conversation_id": new_id}
