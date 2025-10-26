#!/usr/bin/env python3
"""
Conversation Adapter - Transforms pydantic-ai messages to UI-ready format
"""

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
import base64
import uuid
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class UIAttachment:
    id: str
    name: str
    media_type: str
    size: int
    url: str  # API endpoint URL

@dataclass
class UIToolInstance:
    id: str
    name: str
    status: str
    timestamp: str  # ISO format for JSON serialization
    args: Optional[Dict[str, Any]] = None
    result: Optional[str] = None

@dataclass
class UIMessage:
    id: str
    type: str  # 'user' | 'assistant' | 'system' | 'thinking' | 'tool_session'
    timestamp: str  # ISO format for JSON serialization
    content: Optional[str] = None
    subtype: Optional[str] = None  # 'info' | 'error' for system messages
    attachments: Optional[List[UIAttachment]] = None
    tools: Optional[List[UIToolInstance]] = None
    status: Optional[str] = None  # 'executing' | 'completed' | 'blocked'
    is_streaming: Optional[bool] = None
    is_collapsed: Optional[bool] = None

class ConversationAdapter:
    """Adapter to transform pydantic-ai messages to UI-ready format"""
    
    @staticmethod
    def _generate_id() -> str:
        """Generate a unique ID for UI messages"""
        return f"{int(datetime.now().timestamp() * 1000)}-{uuid.uuid4().hex[:9]}"
    
    @staticmethod
    def _get_preview_content(text: str, max_chars: int = 100) -> str:
        """Get preview content - no truncation, just length limit for data transfer"""
        return text[:max_chars] if text else ""
    
    @staticmethod
    def _store_image_attachment(image_data: bytes, media_type: str, conversation_id: str) -> UIAttachment:
        """Store image data and return UI attachment with API endpoint URL"""
        # Create directory for conversation images - use same path resolution as API endpoint
        base = Path(__file__).resolve().parent.parent
        upload_dir = base / "uploads" / "conversation_images" / conversation_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        image_id = str(uuid.uuid4())
        extension = media_type.split('/')[-1]
        filename = f"{image_id}.{extension}"
        file_path = upload_dir / filename
        
        # Write image data to file
        with open(file_path, 'wb') as f:
            f.write(image_data)
        
        logger.info(f"Stored image {filename} for conversation {conversation_id}")
        
        return UIAttachment(
            id=image_id,
            name=filename,
            media_type=media_type,
            size=len(image_data),
            url=f"/api/conversations/{conversation_id}/images/{image_id}"
        )
    
    @staticmethod
    def _get_first_user_message(messages: list) -> str:
        """Extract first user message for preview"""
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
    
    @staticmethod
    def _transform_part_to_ui_message(part: Any, conversation_id: str) -> Optional[UIMessage]:
        """Transform a single pydantic-ai message part to UI message"""
        base_id = ConversationAdapter._generate_id()
        timestamp = getattr(part, "timestamp", datetime.now()).isoformat()
        content = getattr(part, "content", "")
        
        # Convert content to string if needed
        if not isinstance(content, str):
            content = str(content)
        
        part_kind = getattr(part, "part_kind", None)
        
        if part_kind == "system-prompt":
            return None  # Skip system prompts - don't show in chat history
            
        elif part_kind == "user-prompt":
            # Handle user prompts with potential image content
            if isinstance(part.content, list):
                # Extract text and images from content array
                text_content = ""
                attachments = []
                
                for item in part.content:
                    if isinstance(item, str):
                        text_content += item
                    elif hasattr(item, 'kind') and item.kind == 'binary' and hasattr(item, 'media_type') and item.media_type.startswith('image/'):
                        # Convert pydantic-ai BinaryContent to UI attachment
                        try:
                            # pydantic-ai stores image data as raw bytes, not base64
                            image_bytes = item.data  # This is already bytes
                            
                            # Store image and create attachment
                            attachment = ConversationAdapter._store_image_attachment(
                                image_bytes, item.media_type, conversation_id
                            )
                            attachments.append(attachment)
                            
                        except Exception as e:
                            logger.error(f"Failed to process image attachment: {e}")
                            continue
                
                return UIMessage(
                    id=base_id,
                    type="user",
                    timestamp=timestamp,
                    content=text_content,
                    attachments=attachments if attachments else None
                )
            else:
                return UIMessage(
                    id=base_id,
                    type="user",
                    timestamp=timestamp,
                    content=content
                )
                
        elif part_kind == "text":
            return UIMessage(
                id=base_id,
                type="assistant",
                timestamp=timestamp,
                content=content
            )
            
        elif part_kind == "tool-call":
            # Tool calls will be handled separately in tool sessions
            return None
            
        elif part_kind == "tool-return":
            # Tool returns will be handled separately in tool sessions
            return None
            
        elif part_kind == "thinking":
            return UIMessage(
                id=base_id,
                type="thinking",
                timestamp=timestamp,
                content=content,
                is_streaming=False,  # Historical thinking is not streaming
                is_collapsed=True    # Default to collapsed for historical content
            )
            
        elif part_kind == "retry-prompt":
            return UIMessage(
                id=base_id,
                type="system",
                subtype="error",
                timestamp=timestamp,
                content=f"Retry prompt: {content}"
            )
            
        else:
            return UIMessage(
                id=base_id,
                type="system",
                subtype="error",
                timestamp=timestamp,
                content=content
            )
    
    @staticmethod
    def transform_to_ui_messages(pydantic_messages: list, conversation_id: str) -> List[Dict[str, Any]]:
        """Transform pydantic-ai messages to UI-ready format"""
        ui_messages = []
        tool_sessions_map = {}
        
        for msg in pydantic_messages:
            if hasattr(msg, 'parts') and isinstance(msg.parts, list):
                # Handle messages with parts
                for part in msg.parts:
                    part_kind = getattr(part, "part_kind", None)
                    
                    if part_kind == "tool-call":
                        # Create or update tool session
                        tool_call_id = getattr(part, "tool_call_id", None)
                        tool_name = getattr(part, "tool_name", "unknown")
                        timestamp = getattr(part, "timestamp", datetime.now()).isoformat()
                        
                        if tool_call_id and tool_call_id not in tool_sessions_map:
                            session_dict = {
                                "id": ConversationAdapter._generate_id(),
                                "type": "tool_session",
                                "timestamp": timestamp,
                                "status": "completed",
                                "tools": [{
                                    "id": tool_call_id,
                                    "name": tool_name,
                                    "status": "completed",
                                    "timestamp": timestamp,
                                    "args": getattr(part, "args", None),
                                    "result": None
                                }]
                            }
                            tool_sessions_map[tool_call_id] = len(ui_messages)  # Store index
                            ui_messages.append(session_dict)
                        
                    elif part_kind == "tool-return":
                        # Update tool session with result
                        tool_call_id = getattr(part, "tool_call_id", None)
                        if tool_call_id and tool_call_id in tool_sessions_map:
                            session_index = tool_sessions_map[tool_call_id]
                            session = ui_messages[session_index]
                            # Update the tool instance with result
                            for tool in session["tools"]:
                                if tool["id"] == tool_call_id:
                                    tool["result"] = str(getattr(part, "content", ""))
                                    break
                    
                    else:
                        # Handle regular message parts
                        ui_msg = ConversationAdapter._transform_part_to_ui_message(part, conversation_id)
                        if ui_msg:
                            ui_messages.append(asdict(ui_msg))
            else:
                # Handle direct message objects
                ui_msg = ConversationAdapter._transform_part_to_ui_message(msg, conversation_id)
                if ui_msg:
                    ui_messages.append(asdict(ui_msg))
        
        return ui_messages
    
    @staticmethod
    def get_conversation_preview(pydantic_messages: list) -> str:
        """Get a preview of the conversation (first user message)"""
        first_message = ConversationAdapter._get_first_user_message(pydantic_messages)
        return ConversationAdapter._get_preview_content(first_message)
