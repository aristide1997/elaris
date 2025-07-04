#!/usr/bin/env python3
"""
MCP Servers API Router - REST endpoints for MCP server management
"""

from fastapi import APIRouter, HTTPException
import logging

from services.mcp_service import get_mcp_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mcp-servers", tags=["mcp-servers"])

@router.get("/states")
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

@router.post("/toggle")
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
