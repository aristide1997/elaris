#!/usr/bin/env python3
"""
FastAPI WebSocket server for MCP Chat Client
Provides a web interface for the MCP client with tool approval workflow
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import json
import logging
import os

from chat_session import ChatSession

# Configure logging with timestamps and context
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="MCP Chat Web Client", version="1.0.0")

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
        # Initialize MCP servers once for this connection
        async with chat_session.agent.run_mcp_servers():
            logger.info("MCP servers initialized for WebSocket connection")
            
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
                        if user_input:
                            logger.info(f"Received chat message: {user_input}")
                            # Prune any completed tasks to avoid memory growth
                            chat_session.tasks = [t for t in chat_session.tasks if not t.done()]
                            # Schedule handling chat message in background to allow processing approval responses
                            task = asyncio.create_task(chat_session.handle_chat_message(user_input))
                            task.add_done_callback(_log_task_result)
                            chat_session.tasks.append(task)
                    
                    elif data["type"] == "approval_response":
                        # Handle tool approval response
                        approval_id = data["approval_id"]
                        approved = data["approved"]
                        logger.info(f"Received approval response: {approval_id} = {approved}")
                        await chat_session.handle_approval_response(approval_id, approved)
                    
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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting server on port {port} (from PORT env var: {os.environ.get('PORT', 'not set')})")
    uvicorn.run(app, host="0.0.0.0", port=port)
