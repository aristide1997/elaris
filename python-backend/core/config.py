#!/usr/bin/env python3
"""
Unified Configuration Manager - Single source of truth for all configuration
"""

import json
import logging
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable, Set
from dataclasses import dataclass, field
from datetime import datetime

from core.exceptions import ConfigurationError, ValidationError

logger = logging.getLogger(__name__)

# Configuration file path
CONFIG_FILE = "settings.json"

# Default configuration values
DEFAULT_CONFIG = {
    "system_prompt": "You are a helpful AI assistant.",
    "llm_provider": {
        "provider": "openai",
        "model": "gpt-4o-mini",
        "config": {}  # Provider-specific configuration
    },
    "approval_timeout": 60.0,
    "auto_approve_tools": False,
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

@dataclass
class ConfigChangeEvent:
    """Event emitted when configuration changes"""
    changed_keys: Set[str]
    old_values: Dict[str, Any]
    new_values: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)

class ConfigManager:
    """
    Unified configuration manager that handles file-based configuration.
    Provides change detection and observer pattern for configuration changes.
    """
    
    def __init__(self, config_file: str = CONFIG_FILE):
        self.config_file = Path(config_file)
        self._config: Optional[Dict[str, Any]] = None
        self._lock = asyncio.Lock()
        self._observers: List[Callable[[ConfigChangeEvent], None]] = []
        self._last_modified: Optional[float] = None
        
    async def load_config(self) -> Dict[str, Any]:
        """Load configuration from file"""
        async with self._lock:
            # Check if we need to reload from file
            should_reload = self._should_reload_from_file()
            
            if self._config is None or should_reload:
                await self._load_from_file()
                
            return self._config.copy()
    
    def _should_reload_from_file(self) -> bool:
        """Check if configuration file has been modified"""
        if not self.config_file.exists():
            return self._config is None
            
        try:
            current_mtime = self.config_file.stat().st_mtime
            if self._last_modified is None or current_mtime > self._last_modified:
                return True
        except OSError:
            logger.warning(f"Could not check modification time of {self.config_file}")
            
        return False
    
    async def _load_from_file(self):
        """Internal method to load configuration from file"""
        config = DEFAULT_CONFIG.copy()
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    file_config = json.load(f)
                    
                # Validate loaded configuration
                validation_errors = self._validate_config(file_config)
                if validation_errors:
                    raise ValidationError(
                        f"Invalid configuration in {self.config_file}",
                        validation_errors
                    )
                
                # Use file config (overriding defaults)
                config.update(file_config)
                
                # Update last modified time
                self._last_modified = self.config_file.stat().st_mtime
                logger.info(f"Loaded configuration from {self.config_file}")
                
            except (json.JSONDecodeError, OSError) as e:
                raise ConfigurationError(f"Error loading configuration file: {e}")
        else:
            logger.info(f"Configuration file {self.config_file} not found, using defaults")
            # Create file with defaults
            await self._save_to_file(config)
        
        # Final validation
        validation_errors = self._validate_config(config)
        if validation_errors:
            raise ValidationError("Invalid configuration", validation_errors)
        
        self._config = config
    
    async def save_config(self, new_config: Dict[str, Any]) -> None:
        """Save configuration to file with validation and change detection"""
        async with self._lock:
            # Validate new configuration
            validation_errors = self._validate_config(new_config)
            if validation_errors:
                raise ValidationError("Configuration validation failed", validation_errors)
            
            # Detect changes
            old_config = self._config.copy() if self._config else {}
            changed_keys = self._detect_changes(old_config, new_config)
            
            if not changed_keys:
                logger.info("No configuration changes detected")
                return
            
            # Create backup and save
            await self._save_to_file(new_config)
            
            # Update internal state
            old_values = {key: old_config.get(key) for key in changed_keys}
            new_values = {key: new_config.get(key) for key in changed_keys}
            self._config = new_config.copy()
            
            # Notify observers
            change_event = ConfigChangeEvent(changed_keys, old_values, new_values)
            await self._notify_observers(change_event)
            
            logger.info(f"Configuration updated. Changed keys: {', '.join(changed_keys)}")
    
    def _detect_changes(self, old_config: Dict[str, Any], new_config: Dict[str, Any]) -> Set[str]:
        """Detect which configuration keys have changed"""
        changed_keys = set()
        
        # Check for changes in existing keys
        for key in old_config:
            if key not in new_config or old_config[key] != new_config[key]:
                changed_keys.add(key)
        
        # Check for new keys
        for key in new_config:
            if key not in old_config:
                changed_keys.add(key)
        
        return changed_keys
    
    async def _save_to_file(self, config: Dict[str, Any]):
        """Save configuration to file with backup"""
        try:
            # Create backup if file exists
            if self.config_file.exists():
                backup_path = Path(f"{self.config_file}.backup")
                self.config_file.rename(backup_path)
            
            # Write new configuration
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            
            # Remove backup on success
            backup_path = Path(f"{self.config_file}.backup")
            if backup_path.exists():
                backup_path.unlink()
                
            # Update last modified time
            self._last_modified = self.config_file.stat().st_mtime
            
        except OSError as e:
            # Restore backup if save failed
            backup_path = Path(f"{self.config_file}.backup")
            if backup_path.exists():
                backup_path.rename(self.config_file)
            raise ConfigurationError(f"Error saving configuration: {e}")
    
    def _validate_config(self, config: Dict[str, Any]) -> List[str]:
        """Validate configuration structure and values"""
        errors = []
        
        # Check required fields
        required_fields = ["system_prompt", "llm_provider", "approval_timeout", "auto_approve_tools", "mcp_servers"]
        for field in required_fields:
            if field not in config:
                errors.append(f"Missing required field: {field}")
        
        # Validate specific fields
        if "system_prompt" in config:
            if not isinstance(config["system_prompt"], str):
                errors.append("system_prompt must be a string")
            elif not config["system_prompt"].strip():
                errors.append("system_prompt cannot be empty")
        
        # Validate LLM provider configuration
        if "llm_provider" in config:
            llm_errors = self._validate_llm_provider(config["llm_provider"])
            errors.extend(llm_errors)
        
        if "approval_timeout" in config:
            timeout = config["approval_timeout"]
            if not isinstance(timeout, (int, float)):
                errors.append("approval_timeout must be a number")
            elif timeout <= 0:
                errors.append("approval_timeout must be positive")
        
        if "auto_approve_tools" in config:
            if not isinstance(config["auto_approve_tools"], bool):
                errors.append("auto_approve_tools must be a boolean")
        
        # Validate MCP servers
        if "mcp_servers" in config:
            mcp_errors = self._validate_mcp_servers(config["mcp_servers"])
            errors.extend(mcp_errors)
        
        return errors
    
    def _validate_llm_provider(self, llm_provider: Any) -> List[str]:
        """Validate LLM provider configuration"""
        errors = []
        
        if not isinstance(llm_provider, dict):
            errors.append("llm_provider must be an object")
            return errors
        
        # Check required fields
        required_fields = ["provider", "model", "config"]
        for field in required_fields:
            if field not in llm_provider:
                errors.append(f"llm_provider missing required field: {field}")
        
        # Validate provider field
        if "provider" in llm_provider:
            if not isinstance(llm_provider["provider"], str):
                errors.append("llm_provider.provider must be a string")
            elif not llm_provider["provider"].strip():
                errors.append("llm_provider.provider cannot be empty")
        
        # Validate model field
        if "model" in llm_provider:
            if not isinstance(llm_provider["model"], str):
                errors.append("llm_provider.model must be a string")
            elif not llm_provider["model"].strip():
                errors.append("llm_provider.model cannot be empty")
        
        # Validate config field
        if "config" in llm_provider:
            if not isinstance(llm_provider["config"], dict):
                errors.append("llm_provider.config must be an object")
        
        return errors
    
    def _validate_mcp_servers(self, mcp_servers: Any) -> List[str]:
        """Validate MCP servers configuration"""
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
                
            # Validate required fields
            if 'command' not in config:
                errors.append(f"Server '{server_name}' missing required 'command' field")
            elif not isinstance(config['command'], str) or not config['command'].strip():
                errors.append(f"Server '{server_name}' command must be a non-empty string")
                
            # Validate optional fields
            if 'args' in config:
                if not isinstance(config['args'], list):
                    errors.append(f"Server '{server_name}' args must be an array")
                elif not all(isinstance(arg, str) for arg in config['args']):
                    errors.append(f"Server '{server_name}' args must be an array of strings")
                
            if 'env' in config:
                if not isinstance(config['env'], dict):
                    errors.append(f"Server '{server_name}' env must be an object")
                elif not all(isinstance(k, str) and isinstance(v, str) 
                           for k, v in config['env'].items()):
                    errors.append(f"Server '{server_name}' env must be an object with string keys and values")
        
        return errors
    
    async def get_value(self, key: str, default: Any = None) -> Any:
        """Get a specific configuration value"""
        config = await self.load_config()
        return config.get(key, default)
    
    async def update_value(self, key: str, value: Any) -> None:
        """Update a specific configuration value"""
        config = await self.load_config()
        config[key] = value
        await self.save_config(config)
    
    def add_observer(self, callback: Callable[[ConfigChangeEvent], None]) -> None:
        """Add an observer for configuration changes"""
        self._observers.append(callback)
    
    def remove_observer(self, callback: Callable[[ConfigChangeEvent], None]) -> None:
        """Remove an observer for configuration changes"""
        if callback in self._observers:
            self._observers.remove(callback)
    
    async def _notify_observers(self, event: ConfigChangeEvent) -> None:
        """Notify all observers of configuration changes"""
        for observer in self._observers:
            try:
                # If observer is async, await it
                if asyncio.iscoroutinefunction(observer):
                    await observer(event)
                else:
                    observer(event)
            except Exception as e:
                logger.error(f"Error notifying configuration observer: {e}", exc_info=True)
    
    def invalidate(self) -> None:
        """Force reload of configuration on next access"""
        self._config = None
        self._last_modified = None

# Global configuration manager instance
config_manager = ConfigManager()

# Legacy compatibility wrapper for existing code
class LegacySettings:
    """Legacy compatibility wrapper - provides dot notation access to config"""
    
    def __init__(self, config_manager: ConfigManager):
        self._config_manager = config_manager
        self._config = None
    
    async def load_from_settings_file(self):
        """Load configuration from the unified configuration manager"""
        self._config = await self._config_manager.load_config()
    
    @property
    def model_name(self) -> str:
        return self._config.get("model_name", DEFAULT_CONFIG["model_name"]) if self._config else DEFAULT_CONFIG["model_name"]
    
    @property
    def approval_timeout(self) -> float:
        return self._config.get("approval_timeout", DEFAULT_CONFIG["approval_timeout"]) if self._config else DEFAULT_CONFIG["approval_timeout"]
    
    @property
    def mcp_servers(self) -> Dict[str, Dict[str, Any]]:
        return self._config.get("mcp_servers", DEFAULT_CONFIG["mcp_servers"]) if self._config else DEFAULT_CONFIG["mcp_servers"]
    
    @property
    def system_prompt(self) -> str:
        return self._config.get("system_prompt", DEFAULT_CONFIG["system_prompt"]) if self._config else DEFAULT_CONFIG["system_prompt"]

# Legacy compatibility instance
settings = LegacySettings(config_manager)
