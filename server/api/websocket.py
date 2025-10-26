#!/usr/bin/env python3
"""
WebSocket API Handler - Routes WebSocket messages to conversation orchestrator
"""

from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import json
import logging

from core.messaging import WebSocketMessenger
from services.conversation_repository import ConversationRepository
from services.approval_service import ApprovalService
from services.agent_factory import AgentFactory
from services.stream_handler import StreamHandler
from services.conversation_orchestrator import ConversationOrchestrator

logger = logging.getLogger(__name__)

async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint - routes messages to orchestrator"""
    await websocket.accept()
    logger.info("New WebSocket connection established")
    
    messenger = WebSocketMessenger(websocket)
    repository = ConversationRepository()
    approval_service = ApprovalService(messenger)
    agent_factory = AgentFactory()
    stream_handler = StreamHandler(messenger, approval_service)
    
    orchestrator = ConversationOrchestrator(
        messenger=messenger,
        repository=repository,
        agent_factory=agent_factory,
        stream_handler=stream_handler,
        approval_service=approval_service
    )

    def _log_task_result(task: asyncio.Task):
        try:
            exc = task.exception()
            if exc:
                logger.error("Task exception", exc_info=exc)
        except asyncio.CancelledError:
            pass
    
    try:
        await orchestrator.send_ready()
        
        while True:
            try:
                data = await websocket.receive_json()
                
                if data["type"] == "chat_message":
                    user_input = data["content"].strip()
                    images = data.get("images", [])
                    conversation_id = data.get("conversation_id")
                    
                    if not conversation_id:
                        logger.error("Missing conversation_id from client message")
                        await websocket.send_json({"type": "error", "message": "Missing conversation_id"})
                        continue
                    
                    if user_input or images:
                        logger.info(f"Received chat message for conversation: {conversation_id}")
                        orchestrator.tasks = [t for t in orchestrator.tasks if not t.done()]
                        task = asyncio.create_task(orchestrator.handle_chat_message(user_input, conversation_id, images))
                        task.add_done_callback(_log_task_result)
                        orchestrator.tasks.append(task)
                
                elif data["type"] == "approval_response":
                    approval_id = data["approval_id"]
                    approved = data["approved"]
                    logger.info(f"Received approval response: {approval_id} = {approved}")
                    await orchestrator.handle_approval_response(approval_id, approved)
                
                elif data["type"] == "edit_user_message":
                    conversation_id = data.get("conversation_id")
                    user_message_index = data.get("user_message_index")
                    new_content = data.get("new_content", "").strip()
                    
                    if not conversation_id:
                        logger.error("Missing conversation_id from edit message")
                        await websocket.send_json({"type": "error", "message": "Missing conversation_id"})
                        continue
                    
                    if user_message_index is None:
                        logger.error("Missing user_message_index from edit message")
                        await websocket.send_json({"type": "error", "message": "Missing user_message_index"})
                        continue
                    
                    if not new_content:
                        logger.error("Missing new_content from edit message")
                        await websocket.send_json({"type": "error", "message": "Missing new_content"})
                        continue
                    
                    logger.info(f"Received edit request: conversation {conversation_id}, user message {user_message_index}")
                    orchestrator.tasks = [t for t in orchestrator.tasks if not t.done()]
                    task = asyncio.create_task(orchestrator.handle_edit_message(conversation_id, user_message_index, new_content))
                    task.add_done_callback(_log_task_result)
                    orchestrator.tasks.append(task)
                
                elif data["type"] == "update_settings":
                    logger.info("Received update_settings via WebSocket")
                    await orchestrator.send_ready("Settings updated successfully")
                
                elif data["type"] == "stop_stream":
                    logger.info(f"Received stop_stream for conversation: {data.get('conversation_id')}")
                    for task in orchestrator.tasks:
                        if not task.done():
                            task.cancel()
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
            pass
    finally:
        logger.info("Cleaning up WebSocket connection")
        for t in getattr(orchestrator, 'tasks', []):
            if not t.done():
                t.cancel()
        logger.info("Cancelled background tasks")
        
        try:
            await orchestrator.cleanup()
        except Exception as e:
            logger.error(f"Error during orchestrator cleanup: {e}")
