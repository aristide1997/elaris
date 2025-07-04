#!/usr/bin/env python3
"""
Settings Service - Business logic for settings operations
"""

import logging
from typing import Dict, Any, List
from dataclasses import dataclass

from core.config import config_manager
from core.exceptions import ValidationError, SettingsError

logger = logging.getLogger(__name__)

@dataclass
class SettingsUpdateResult:
    """Result of a settings update operation"""
    success: bool
    message: str
    errors: List[str] = None
    changed_keys: List[str] = None

class SettingsService:
    """
    Service class that handles all settings-related business logic.
    Provides atomic operations with proper error handling.
    """
    
    def __init__(self):
        self.config_manager = config_manager
    
    async def get_settings(self) -> Dict[str, Any]:
        """Get current settings"""
        try:
            return await self.config_manager.load_config()
        except Exception as e:
            logger.error(f"Failed to load settings: {e}", exc_info=True)
            raise SettingsError(f"Failed to load settings: {e}")
    
    async def update_settings(self, new_settings: Dict[str, Any]) -> SettingsUpdateResult:
        """
        Update settings with atomic operation and rollback capability.
        Returns detailed result with success status and any errors.
        """
        try:
            # Get current settings for rollback
            current_settings = await self.config_manager.load_config()
            
            # Validate new settings
            validation_errors = self.config_manager._validate_config(new_settings)
            if validation_errors:
                return SettingsUpdateResult(
                    success=False,
                    message="Settings validation failed",
                    errors=validation_errors
                )
            
            # Detect what would change
            changed_keys = list(self.config_manager._detect_changes(current_settings, new_settings))
            
            if not changed_keys:
                return SettingsUpdateResult(
                    success=True,
                    message="No changes detected",
                    changed_keys=[]
                )
            
            # Attempt to save settings
            await self.config_manager.save_config(new_settings)
            
            logger.info(f"Settings updated successfully. Changed: {', '.join(changed_keys)}")
            
            return SettingsUpdateResult(
                success=True,
                message="Settings updated successfully",
                changed_keys=changed_keys
            )
            
        except ValidationError as e:
            logger.error(f"Settings validation error: {e}")
            return SettingsUpdateResult(
                success=False,
                message=str(e),
                errors=e.errors if hasattr(e, 'errors') else [str(e)]
            )
            
        except Exception as e:
            logger.error(f"Failed to update settings: {e}", exc_info=True)
            
            # Attempt rollback
            try:
                await self.config_manager.save_config(current_settings)
                logger.info("Settings rollback successful")
                return SettingsUpdateResult(
                    success=False,
                    message=f"Settings update failed and was rolled back: {str(e)}",
                    errors=[str(e)]
                )
            except Exception as rollback_error:
                logger.error(f"Settings rollback failed: {rollback_error}", exc_info=True)
                return SettingsUpdateResult(
                    success=False,
                    message=f"Settings update failed and rollback also failed: {str(e)}",
                    errors=[str(e), f"Rollback error: {str(rollback_error)}"]
                )
    
    async def validate_settings(self, settings: Dict[str, Any]) -> SettingsUpdateResult:
        """
        Validate settings without saving them.
        Useful for client-side validation feedback.
        """
        try:
            validation_errors = self.config_manager._validate_config(settings)
            
            if validation_errors:
                return SettingsUpdateResult(
                    success=False,
                    message="Settings validation failed",
                    errors=validation_errors
                )
            
            return SettingsUpdateResult(
                success=True,
                message="Settings validation passed"
            )
            
        except Exception as e:
            logger.error(f"Settings validation error: {e}", exc_info=True)
            return SettingsUpdateResult(
                success=False,
                message=f"Validation error: {str(e)}",
                errors=[str(e)]
            )
    
    async def validate_mcp_servers(self, mcp_servers: Dict[str, Any]) -> SettingsUpdateResult:
        """
        Validate MCP servers configuration specifically.
        Useful for detailed MCP validation feedback.
        """
        try:
            validation_errors = self.config_manager._validate_mcp_servers(mcp_servers)
            
            if validation_errors:
                return SettingsUpdateResult(
                    success=False,
                    message="MCP servers validation failed",
                    errors=validation_errors
                )
            
            return SettingsUpdateResult(
                success=True,
                message="MCP servers validation passed"
            )
            
        except Exception as e:
            logger.error(f"MCP servers validation error: {e}", exc_info=True)
            return SettingsUpdateResult(
                success=False,
                message=f"MCP validation error: {str(e)}",
                errors=[str(e)]
            )
    
    async def get_setting(self, key: str, default: Any = None) -> Any:
        """Get a specific setting value"""
        try:
            return await self.config_manager.get_value(key, default)
        except Exception as e:
            logger.error(f"Failed to get setting '{key}': {e}", exc_info=True)
            raise SettingsError(f"Failed to get setting '{key}': {e}")
    
    async def update_setting(self, key: str, value: Any) -> SettingsUpdateResult:
        """Update a single setting value"""
        try:
            current_settings = await self.config_manager.load_config()
            current_settings[key] = value
            return await self.update_settings(current_settings)
        except Exception as e:
            logger.error(f"Failed to update setting '{key}': {e}", exc_info=True)
            return SettingsUpdateResult(
                success=False,
                message=f"Failed to update setting '{key}': {str(e)}",
                errors=[str(e)]
            )
    
    async def reset_to_defaults(self) -> SettingsUpdateResult:
        """Reset all settings to default values"""
        try:
            from core.config import DEFAULT_CONFIG
            return await self.update_settings(DEFAULT_CONFIG.copy())
        except Exception as e:
            logger.error(f"Failed to reset settings to defaults: {e}", exc_info=True)
            return SettingsUpdateResult(
                success=False,
                message=f"Failed to reset settings: {str(e)}",
                errors=[str(e)]
            )
    
    def add_config_observer(self, callback) -> None:
        """Add observer for configuration changes"""
        self.config_manager.add_observer(callback)
    
    def remove_config_observer(self, callback) -> None:
        """Remove observer for configuration changes"""
        self.config_manager.remove_observer(callback)

# Global settings service instance
settings_service = SettingsService()
