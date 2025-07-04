#!/usr/bin/env python3
"""
FastAPI WebSocket server for MCP Chat Client
Provides a web interface for the MCP client with tool approval workflow
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import logging
import os
from uuid import uuid4
from types import SimpleNamespace

from chat_session import ChatSession
from conversation_db import init_db, get_conversation_history, get_conversation_by_id, delete_conversation, save_conversation
from settings_service import settings_service
from config import config_manager
from mcp_manager import get_mcp_manager
from exceptions import ValidationError, SettingsError, MCPServerError

# Configure logging with timestamps and context
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="MCP Chat Web Client", version="1.0.0")

# Allow cross-origin requests from any origin (e.g. Vite dev server or Electron renderer)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API endpoints for conversation management
@app.get("/api/conversations")
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
                    "preview": next((msg["content"] for msg in conv["messages"] 
                                    if isinstance(msg, dict) and msg.get("type") == "user_prompt"), "")
                }
                for conv in conversations
            ]
        }
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get a specific conversation by ID"""
    conversation = await get_conversation_by_id(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail=f"Conversation {conversation_id} not found")
    return {
        "status": "success",
        "conversation": conversation
    }

@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation_by_id(conversation_id: str):
    """Delete a specific conversation by ID"""
    success = await delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Conversation {conversation_id} not found")
    return {
        "status": "success",
        "message": f"Conversation {conversation_id} deleted"
    }

@app.post("/api/conversations")
async def create_conversation():
    """Create a new empty conversation stub"""
    new_id = str(uuid4())
    usage = SimpleNamespace(total_tokens=0, request_tokens=0, response_tokens=0, requests=0)
    await save_conversation(new_id, [], usage)
    return {"conversation_id": new_id}

# API endpoints for settings management
@app.get("/api/settings")
async def get_settings():
    """Get current settings"""
    try:
        current_settings = await settings_service.get_settings()
        return {
            "status": "success",
            "settings": current_settings
        }
    except SettingsError as e:
        logger.error(f"Settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/settings")
async def update_settings(new_settings: dict):
    """Update settings"""
    try:
        result = await settings_service.update_settings(new_settings)
        
        if result.success:
            return {
                "status": "success",
                "message": result.message,
                "changed_keys": result.changed_keys
            }
        else:
            return {
                "status": "error",
                "message": result.message,
                "errors": result.errors
            }
            
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/settings/validate-mcp")
async def validate_mcp_config(mcp_config: dict):
    """Validate MCP servers configuration"""
    try:
        result = await settings_service.validate_mcp_servers(mcp_config)
        return {
            "status": "success",
            "valid": result.success,
            "errors": result.errors if not result.success else []
        }
    except Exception as e:
        logger.error(f"Error validating MCP config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API endpoints for MCP server runtime management
@app.get("/api/mcp-servers/states")
async def get_mcp_server_states():
    """Get current states of all MCP servers"""
    try:
        mcp_manager = await get_mcp_manager()
        states = mcp_manager.get_server_states()
        return {
            "status": "success",
            "servers": states
        }
    except Exception as e:
        logger.error(f"Error getting MCP server states: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/mcp-servers/toggle")
async def toggle_mcp_server(request: dict):
    """Toggle an individual MCP server on/off"""
    try:
        server_name = request.get("server_name")
        enabled = request.get("enabled")
        
        if server_name is None or enabled is None:
            raise HTTPException(status_code=400, detail="Missing server_name or enabled parameter")
        
        mcp_manager = await get_mcp_manager()
        success = await mcp_manager.toggle_server(server_name, enabled)
        
        if success:
            return {
                "status": "success",
                "message": f"Server '{server_name}' {'enabled' if enabled else 'disabled'} successfully"
            }
        else:
            return {
                "status": "error",
                "message": f"Failed to {'enable' if enabled else 'disable'} server '{server_name}'"
            }
            
    except Exception as e:
        logger.error(f"Error toggling MCP server: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("startup")
async def startup_event():
    """Initialize resources on startup"""
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database initialized")
    
    logger.info("Loading configuration...")
    await config_manager.load_config()
    logger.info("Configuration loaded")
    
    logger.info("Initializing Global MCP Manager...")
    await get_mcp_manager()
    logger.info("Global MCP Manager initialized")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for chat communication"""
    await websocket.accept()
    logger.info("New WebSocket connection established")
    
    # Create a new chat session instance
    chat_session = ChatSession(websocket)

    # Callback to log exceptions from background tasks
    def _log_task_result(task: asyncio.Task):
        try:
            exc = task.exception()
            if exc:
                logger.error("Chat task exception", exc_info=exc)
        except asyncio.CancelledError:
            pass
    
    try:
        # Send ready signal to client
        await chat_session.send_system_ready()
        
        # Main message handling loop
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_json()
                
                if data["type"] == "chat_message":
                    # Handle chat message
                    user_input = data["content"].strip()
                    # Require conversation_id (provided by frontend)
                    conversation_id = data.get("conversation_id")
                    if not conversation_id:
                        logger.error("Missing conversation_id from client message")
                        await websocket.send_json({"type": "error", "message": "Missing conversation_id"})
                        continue
                    
                    if user_input:
                        logger.info(f"Received chat message: {user_input} for conversation: {conversation_id}")
                        # Prune any completed tasks to avoid memory growth
                        chat_session.tasks = [t for t in chat_session.tasks if not t.done()]
                        # Schedule handling chat message in background to allow processing approval responses
                        task = asyncio.create_task(chat_session.handle_chat_message(user_input, conversation_id))
                        task.add_done_callback(_log_task_result)
                        chat_session.tasks.append(task)
                
                elif data["type"] == "approval_response":
                    # Handle tool approval response
                    approval_id = data["approval_id"]
                    approved = data["approved"]
                    logger.info(f"Received approval response: {approval_id} = {approved}")
                    await chat_session.handle_approval_response(approval_id, approved)
                
                elif data["type"] == "update_settings":
                    # Handle dynamic settings update mid-session
                    logger.info("Received update_settings via WebSocket - next message will use updated settings automatically")
                    await chat_session.send_system_ready("Settings updated successfully")
                
                else:
                    logger.warning(f"Unknown message type: {data['type']}")
                    
            except json.JSONDecodeError:
                logger.error("Invalid JSON received from client")
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format"
                })
                
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error", 
                "message": f"Server error: {str(e)}"
            })
        except:
            pass  # Connection might be closed
    finally:
        logger.info("Cleaning up WebSocket connection")
        # Cancel any pending chat handling tasks
        for t in getattr(chat_session, 'tasks', []):
            if not t.done():
                t.cancel()
        logger.info("Cancelled background chat tasks")
        
        # Cleanup chat session resources
        try:
            await chat_session.cleanup()
        except Exception as e:
            logger.error(f"Error during chat session cleanup: {e}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting server on port {port} (from PORT env var: {os.environ.get('PORT', 'not set')})")
    uvicorn.run(app, host="0.0.0.0", port=port)
