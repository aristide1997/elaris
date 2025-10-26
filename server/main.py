#!/usr/bin/env python3
"""
MCP Chat Backend - FastAPI application
"""

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

from api.conversations import router as conversations_router
from api.settings import router as settings_router
from api.mcp_servers import router as mcp_servers_router
from api.llm_providers import router as llm_providers_router
from api.websocket import websocket_endpoint
from core.database import init_db
from core.config import config_manager
from services.mcp_service import get_mcp_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="MCP Chat Web Client", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(conversations_router)
app.include_router(settings_router)
app.include_router(mcp_servers_router)
app.include_router(llm_providers_router)

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_handler(websocket: WebSocket):
    """WebSocket endpoint for chat communication"""
    await websocket_endpoint(websocket)

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting server on port {port} (from PORT env var: {os.environ.get('PORT', 'not set')})")
    uvicorn.run(app, host="0.0.0.0", port=port)
