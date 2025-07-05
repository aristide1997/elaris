#!/usr/bin/env python3
"""
LLM Provider API endpoints
"""

import logging
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.llm_provider_service import llm_provider_service, ProviderConfig
from core.config import config_manager
from core.exceptions import ConfigurationError

logger = logging.getLogger(__name__)

# API Router
router = APIRouter(prefix="/api/llm-providers", tags=["LLM Providers"])

class ProviderConfigRequest(BaseModel):
    """Request model for provider configuration"""
    provider: str = Field(..., description="Provider name")
    model: str = Field(..., description="Model name")
    config: Dict[str, Any] = Field(default_factory=dict, description="Provider-specific configuration")

class ProviderTestRequest(BaseModel):
    """Request model for testing provider connection"""
    provider: str = Field(..., description="Provider name")
    model: str = Field(..., description="Model name")
    config: Dict[str, Any] = Field(default_factory=dict, description="Provider-specific configuration")

@router.get("/available")
async def get_available_providers():
    """Get all available LLM providers with their configuration requirements"""
    try:
        providers = llm_provider_service.get_available_providers()
        
        # Convert to JSON-serializable format
        result = {}
        for name, provider_info in providers.items():
            result[name] = {
                "name": provider_info.name,
                "display_name": provider_info.display_name,
                "description": provider_info.description,
                "auth_fields": provider_info.auth_fields,
                "supports_base_url": provider_info.supports_base_url,
                "default_models": provider_info.default_models
            }
        
        return {
            "success": True,
            "providers": result
        }
        
    except Exception as e:
        logger.error(f"Error getting available providers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get providers: {str(e)}")

@router.get("/current")
async def get_current_provider():
    """Get the currently configured LLM provider"""
    try:
        config = await config_manager.load_config()
        llm_config = config.get("llm_provider", {})
        
        return {
            "success": True,
            "current_provider": {
                "provider": llm_config.get("provider", ""),
                "model": llm_config.get("model", ""),
                "config": llm_config.get("config", {})
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting current provider: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get current provider: {str(e)}")

@router.post("/test")
async def test_provider_configuration(request: ProviderTestRequest):
    """Test a provider configuration"""
    try:
        provider_config = ProviderConfig(
            provider=request.provider,
            model=request.model,
            config=request.config
        )
        
        result = llm_provider_service.test_provider_connection(provider_config)
        
        return {
            "success": result["success"],
            "message": result["message"],
            "provider_name": result.get("provider_name"),
            "base_url": result.get("base_url"),
            "error": result.get("error")
        }
        
    except Exception as e:
        logger.error(f"Error testing provider: {e}", exc_info=True)
        return {
            "success": False,
            "message": "Provider test failed",
            "error": str(e)
        }

@router.post("/configure")
async def configure_provider(request: ProviderConfigRequest):
    """Configure the LLM provider"""
    try:
        # Create provider config
        provider_config = ProviderConfig(
            provider=request.provider,
            model=request.model,
            config=request.config
        )
        
        # Validate the configuration
        errors = llm_provider_service.validate_provider_config(provider_config)
        if errors:
            raise HTTPException(status_code=400, detail=f"Configuration validation failed: {', '.join(errors)}")
        
        # Test the provider connection
        test_result = llm_provider_service.test_provider_connection(provider_config)
        if not test_result["success"]:
            raise HTTPException(status_code=400, detail=f"Provider connection test failed: {test_result.get('error', 'Unknown error')}")
        
        # Update configuration
        config = await config_manager.load_config()
        config["llm_provider"] = {
            "provider": request.provider,
            "model": request.model,
            "config": request.config
        }
        
        await config_manager.save_config(config)
        
        return {
            "success": True,
            "message": f"Successfully configured {request.provider} provider with model {request.model}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error configuring provider: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to configure provider: {str(e)}")
