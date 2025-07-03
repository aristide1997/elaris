#!/usr/bin/env python3
"""
Settings management - JSON file-based configuration storage
"""

import json
import logging
import os
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path

logger = logging.getLogger(__name__)

# Settings file path
SETTINGS_FILE = "settings.json"

# Default settings
DEFAULT_SETTINGS = {
    "system_prompt": "You are a helpful AI assistant.",
    "model_name": "openai:gpt-4o-mini",
    "approval_timeout": 60.0,
    "mcp_servers": {
        "desktop-commander": {
            "command": "npx",
            "args": ["-y", "@wonderwhy-er/desktop-commander", "stdio"]
        },
        "context7": {
            "command": "npx", 
            "args": ["-y", "@upstash/context7-mcp"]
        }
    }
}

class SettingsManager:
    def __init__(self):
        self._settings = None
        self._lock = asyncio.Lock()
        
    async def load_settings(self) -> Dict[str, Any]:
        """Load settings from file, create with defaults if not exists"""
        async with self._lock:
            if self._settings is not None:
                return self._settings
                
            settings_path = Path(SETTINGS_FILE)
            
            if settings_path.exists():
                try:
                    with open(settings_path, 'r', encoding='utf-8') as f:
                        self._settings = json.load(f)
                    logger.info(f"Loaded settings from {SETTINGS_FILE}")
                except (json.JSONDecodeError, OSError) as e:
                    logger.error(f"Error loading settings file: {e}")
                    logger.info("Using default settings")
                    self._settings = DEFAULT_SETTINGS.copy()
            else:
                logger.info(f"Settings file {SETTINGS_FILE} not found, creating with defaults")
                self._settings = DEFAULT_SETTINGS.copy()
                await self._save_settings()
                
            return self._settings
    
    async def save_settings(self, settings: Dict[str, Any]) -> None:
        """Save settings to file"""
        async with self._lock:
            # Validate settings before saving
            validation_errors = validate_settings(settings)
            if validation_errors:
                raise ValueError(f"Invalid settings: {', '.join(validation_errors)}")
            
            self._settings = settings.copy()
            await self._save_settings()
    
    async def _save_settings(self) -> None:
        """Internal method to save current settings to file"""
        try:
            # Create backup of existing file
            settings_path = Path(SETTINGS_FILE)
            if settings_path.exists():
                backup_path = Path(f"{SETTINGS_FILE}.backup")
                settings_path.rename(backup_path)
            
            # Write new settings
            with open(settings_path, 'w', encoding='utf-8') as f:
                json.dump(self._settings, f, indent=2, ensure_ascii=False)
            
            # Remove backup on success
            backup_path = Path(f"{SETTINGS_FILE}.backup")
            if backup_path.exists():
                backup_path.unlink()
                
            logger.info(f"Settings saved to {SETTINGS_FILE}")
            
        except OSError as e:
            logger.error(f"Error saving settings: {e}")
            # Restore backup if save failed
            backup_path = Path(f"{SETTINGS_FILE}.backup")
            if backup_path.exists():
                backup_path.rename(settings_path)
            raise
    
    async def get_setting(self, key: str, default: Any = None) -> Any:
        """Get a specific setting value"""
        settings = await self.load_settings()
        return settings.get(key, default)
    
    async def update_setting(self, key: str, value: Any) -> None:
        """Update a specific setting"""
        settings = await self.load_settings()
        settings[key] = value
        await self.save_settings(settings)
    
    def invalidate_cache(self) -> None:
        """Invalidate cached settings (force reload on next access)"""
        self._settings = None

def validate_settings(settings: Dict[str, Any]) -> List[str]:
    """
    Validate settings structure and values
    Returns list of validation errors (empty if valid)
    """
    errors = []
    
    # Check required fields
    required_fields = ["system_prompt", "model_name", "approval_timeout", "mcp_servers"]
    for field in required_fields:
        if field not in settings:
            errors.append(f"Missing required field: {field}")
    
    # Validate specific fields
    if "system_prompt" in settings and not isinstance(settings["system_prompt"], str):
        errors.append("system_prompt must be a string")
    
    if "model_name" in settings and not isinstance(settings["model_name"], str):
        errors.append("model_name must be a string")
    
    if "approval_timeout" in settings:
        timeout = settings["approval_timeout"]
        if not isinstance(timeout, (int, float)) or timeout <= 0:
            errors.append("approval_timeout must be a positive number")
    
    # Validate MCP servers
    if "mcp_servers" in settings:
        mcp_errors = validate_mcp_servers(settings["mcp_servers"])
        errors.extend(mcp_errors)
    
    return errors

def validate_mcp_servers(mcp_servers: Dict[str, Any]) -> List[str]:
    """
    Validate MCP servers configuration
    Returns list of validation errors (empty if valid)
    """
    errors = []
    
    if not isinstance(mcp_servers, dict):
        errors.append("mcp_servers must be an object")
        return errors
    
    for server_name, config in mcp_servers.items():
        if not isinstance(server_name, str) or not server_name.strip():
            errors.append("Server name must be a non-empty string")
            continue
            
        if not isinstance(config, dict):
            errors.append(f"Server '{server_name}' config must be an object")
            continue
            
        if 'command' not in config:
            errors.append(f"Server '{server_name}' missing required 'command' field")
        elif not isinstance(config['command'], str) or not config['command'].strip():
            errors.append(f"Server '{server_name}' command must be a non-empty string")
            
        if 'args' in config:
            if not isinstance(config['args'], list):
                errors.append(f"Server '{server_name}' args must be an array")
            elif not all(isinstance(arg, str) for arg in config['args']):
                errors.append(f"Server '{server_name}' args must be an array of strings")
            
        if 'env' in config:
            if not isinstance(config['env'], dict):
                errors.append(f"Server '{server_name}' env must be an object")
            elif not all(isinstance(k, str) and isinstance(v, str) for k, v in config['env'].items()):
                errors.append(f"Server '{server_name}' env must be an object with string keys and values")
    
    return errors

# Global settings manager instance
settings_manager = SettingsManager()
