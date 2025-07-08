#!/usr/bin/env python3
"""
WebSocket API Handler - WebSocket endpoint for chat communication
"""

from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import json
import logging

from services.chat_service import ChatSession

logger = logging.getLogger(__name__)

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
                elif data["type"] == "stop_stream":
                    # User requested to stop the current stream
                    logger.info(f"Received stop_stream for conversation: {data.get('conversation_id')}")
                    for task in chat_session.tasks:
                        if not task.done():
                            task.cancel()
                    # Notify client that assistant has stopped
                    await websocket.send_json({"type": "assistant_complete"})
                    continue
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
