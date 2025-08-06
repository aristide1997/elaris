#!/usr/bin/env python3
"""
Conversation API Router - REST endpoints for conversation management
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from uuid import uuid4
from types import SimpleNamespace
import logging
from pathlib import Path

from core.database import get_conversation_history, get_conversation_by_id, delete_conversation, save_conversation
from adapters.conversation_adapter import ConversationAdapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

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
                    # Use adapter for preview generation
                    "preview": ConversationAdapter.get_conversation_preview(conv["messages"])
                }
                for conv in conversations
            ]
        }
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get a specific conversation by ID with UI-ready message format"""
    conversation = await get_conversation_by_id(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail=f"Conversation {conversation_id} not found")
    
    # Transform to UI format using adapter
    ui_messages = ConversationAdapter.transform_to_ui_messages(
        conversation["messages"], 
        conversation_id
    )
    
    return {
        "status": "success",
        "conversation": {
            "conversation_id": conversation["conversation_id"],
            "created_at": conversation["created_at"],
            "updated_at": conversation["updated_at"],
            "messages": ui_messages
        }
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

@router.get("/{conversation_id}/images/{image_id}")
async def get_conversation_image(conversation_id: str, image_id: str):
    """Serve conversation images"""
    # Resolve absolute path based on this module, not cwd()
    base = Path(__file__).resolve().parent.parent
    image_dir = base / "uploads" / "conversation_images" / conversation_id

    # Search for the image by supported extensions
    extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    for ext in extensions:
        image_path = image_dir / f"{image_id}.{ext}"
        if image_path.exists():
            # Map extension to media type
            media_type_map = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp'
            }
            media_type = media_type_map.get(ext, 'application/octet-stream')
            try:
                return FileResponse(
                    path=str(image_path),
                    media_type=media_type,
                    headers={"Cache-Control": "public, max-age=3600"},
                )
            except OSError as e:
                logger.error(f"Error serving image {image_id} for conversation {conversation_id}: {e}")
                raise HTTPException(status_code=500, detail="Failed to serve image")

    # If no matching file was found, return 404
    raise HTTPException(status_code=404, detail="Image not found")

@router.post("")
async def create_conversation():
    """Create a new empty conversation stub"""
    new_id = str(uuid4())
    usage = SimpleNamespace(total_tokens=0, request_tokens=0, response_tokens=0, requests=0)
    await save_conversation(new_id, [], usage)
    return {"conversation_id": new_id}
