#!/usr/bin/env python3
"""
Settings API Router - REST endpoints for settings management
"""

from fastapi import APIRouter, HTTPException
import logging

from services.settings_service import settings_service
from core.exceptions import SettingsError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("")
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

@router.put("")
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

@router.post("/validate-mcp")
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
