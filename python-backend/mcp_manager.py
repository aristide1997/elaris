#!/usr/bin/env python3
"""
Global MCP Manager - Centralized MCP server lifecycle management
"""

import asyncio
import logging
import os
from typing import List, Dict, Any, Optional
from contextlib import AsyncExitStack

from pydantic_ai.mcp import MCPServerStdio
from config import config_manager, ConfigChangeEvent
from exceptions import MCPServerError

logger = logging.getLogger(__name__)

class GlobalMCPManager:
    """
    Global MCP server manager that handles the lifecycle of all MCP servers.
    Provides a singleton pattern for server pool management.
    """
    
    _instance: Optional['GlobalMCPManager'] = None
    _lock = asyncio.Lock()
    
    def __init__(self):
        self.servers: List[MCPServerStdio] = []
        self.server_configs: Dict[str, Dict[str, Any]] = {}
        self._exit_stack: Optional[AsyncExitStack] = None
        self._initialized = False
        self._initialization_lock = asyncio.Lock()
        
        # Runtime toggles - servers that are configured but disabled
        self.disabled_servers: set[str] = set()
        
        # Register for configuration changes
        config_manager.add_observer(self._on_config_change)
    
    @classmethod
    async def get_instance(cls) -> 'GlobalMCPManager':
        """Get the singleton instance of the MCP manager"""
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
                    await cls._instance.initialize()
        return cls._instance
    
    async def initialize(self) -> None:
        """Initialize the MCP manager with current configuration"""
        async with self._initialization_lock:
            if self._initialized:
                return
                
            logger.info("Initializing Global MCP Manager")
            
            try:
                # Load current configuration
                config = await config_manager.load_config()
                mcp_servers_config = config.get("mcp_servers", {})
                
                # Start MCP servers
                await self._start_servers(mcp_servers_config)
                
                self._initialized = True
                logger.info("Global MCP Manager initialized successfully")
                
            except Exception as e:
                logger.error(f"Failed to initialize Global MCP Manager: {e}", exc_info=True)
                raise MCPServerError(f"MCP Manager initialization failed: {e}")
    
    async def _start_servers(self, mcp_servers_config: Dict[str, Dict[str, Any]]) -> None:
        """Start MCP servers based on configuration"""
        # Stop existing servers first
        await self._stop_servers()
        
        self.servers = []
        self.server_configs = mcp_servers_config.copy()
        
        if not mcp_servers_config:
            logger.info("No MCP servers configured")
            return
        
        # Initialize exit stack for server lifecycle management
        self._exit_stack = AsyncExitStack()
        
        for server_name, config in mcp_servers_config.items():
            try:
                # Expand environment variables in args
                expanded_args = []
                if "args" in config:
                    for arg in config["args"]:
                        if isinstance(arg, str):
                            expanded_args.append(os.path.expandvars(arg))
                        else:
                            expanded_args.append(arg)
                
                # Create MCP server instance
                server = MCPServerStdio(
                    config["command"],
                    args=expanded_args,
                    env=config.get("env"),
                    # Note: process_tool_call will be set by individual agents
                )
                
                # Start the server
                await self._exit_stack.enter_async_context(server)
                self.servers.append(server)
                
                logger.info(f"Started MCP server: {server_name}")
                
            except Exception as e:
                logger.error(f"Failed to start MCP server '{server_name}': {e}", exc_info=True)
                # Continue starting other servers instead of failing completely
                continue
        
        logger.info(f"Started {len(self.servers)} MCP servers successfully")
    
    async def _stop_servers(self) -> None:
        """Stop all MCP servers"""
        if self._exit_stack:
            try:
                await self._exit_stack.aclose()
                logger.info("Stopped all MCP servers")
            except Exception as e:
                logger.error(f"Error stopping MCP servers: {e}", exc_info=True)
            finally:
                self._exit_stack = None
        
        self.servers = []
        self.server_configs = {}
    
    async def _on_config_change(self, event: ConfigChangeEvent) -> None:
        """Handle configuration changes - restart servers only if MCP config changed"""
        if "mcp_servers" not in event.changed_keys:
            logger.info("Configuration changed but MCP servers config unchanged, no restart needed")
            return
        
        logger.info("MCP servers configuration changed, restarting servers")
        
        try:
            # Get new MCP configuration
            new_mcp_config = event.new_values.get("mcp_servers", {})
            
            # Restart servers with new configuration
            await self._start_servers(new_mcp_config)
            
            logger.info("MCP servers restarted successfully after configuration change")
            
        except Exception as e:
            logger.error(f"Failed to restart MCP servers after configuration change: {e}", exc_info=True)
            # Try to restore previous state
            try:
                old_mcp_config = event.old_values.get("mcp_servers", {})
                await self._start_servers(old_mcp_config)
                logger.info("Restored previous MCP server configuration after failure")
            except Exception as restore_error:
                logger.error(f"Failed to restore previous MCP configuration: {restore_error}", exc_info=True)
                raise MCPServerError("Failed to restart MCP servers and could not restore previous state")
    
    def get_servers(self) -> List[MCPServerStdio]:
        """Get the list of active MCP servers"""
        return self.servers.copy()
    
    def get_server_configs(self) -> Dict[str, Dict[str, Any]]:
        """Get the current server configurations"""
        return self.server_configs.copy()
    
    def get_enabled_servers(self) -> List[MCPServerStdio]:
        """Get the list of enabled (not disabled) MCP servers"""
        if not self.server_configs:
            return []
        
        enabled_servers = []
        for i, server in enumerate(self.servers):
            # Map server index to server name (we need to track this better)
            server_names = list(self.server_configs.keys())
            if i < len(server_names):
                server_name = server_names[i]
                if server_name not in self.disabled_servers:
                    enabled_servers.append(server)
        
        return enabled_servers
    
    def get_server_states(self) -> Dict[str, Dict[str, Any]]:
        """Get current states of all configured MCP servers"""
        states = {}
        
        # Get list of server names in the same order as servers list
        server_names = list(self.server_configs.keys())
        
        for i, server_name in enumerate(server_names):
            is_configured = True
            is_enabled = server_name not in self.disabled_servers
            is_running = False
            
            # Check if corresponding server is running
            if i < len(self.servers):
                server = self.servers[i]
                try:
                    # Check if the server process is alive
                    if hasattr(server, '_process') and server._process:
                        is_running = server._process.returncode is None
                    else:
                        # If no process attribute, assume running if server exists
                        is_running = True
                except Exception as e:
                    logger.error(f"Error checking server {server_name} status: {e}")
                    is_running = False
            
            states[server_name] = {
                "configured": is_configured,
                "enabled": is_enabled,
                "running": is_running and is_enabled  # Only show as running if enabled
            }
        
        return states
    
    async def toggle_server(self, server_name: str, enabled: bool) -> bool:
        """Toggle an individual MCP server on/off"""
        if server_name not in self.server_configs:
            logger.error(f"Server '{server_name}' not found in configuration")
            return False
        
        try:
            if enabled:
                # Enable server (remove from disabled set)
                self.disabled_servers.discard(server_name)
                logger.info(f"Enabled MCP server: {server_name}")
            else:
                # Disable server (add to disabled set)
                self.disabled_servers.add(server_name)
                logger.info(f"Disabled MCP server: {server_name}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to toggle server '{server_name}': {e}", exc_info=True)
            return False
    
    async def restart_servers(self) -> None:
        """Manually restart all MCP servers with current configuration"""
        logger.info("Manually restarting MCP servers")
        
        try:
            config = await config_manager.load_config()
            mcp_servers_config = config.get("mcp_servers", {})
            await self._start_servers(mcp_servers_config)
            logger.info("MCP servers restarted successfully")
            
        except Exception as e:
            logger.error(f"Failed to restart MCP servers: {e}", exc_info=True)
            raise MCPServerError(f"Failed to restart MCP servers: {e}")
    
    async def health_check(self) -> Dict[str, bool]:
        """Perform health check on all MCP servers"""
        health_status = {}
        
        for i, server in enumerate(self.servers):
            server_name = f"server_{i}"  # We don't have names in the server objects
            try:
                # Simple health check - just verify the server process is alive
                # More sophisticated health checks could be added here
                if hasattr(server, '_process') and server._process:
                    health_status[server_name] = server._process.returncode is None
                else:
                    health_status[server_name] = False
            except Exception as e:
                logger.error(f"Health check failed for {server_name}: {e}")
                health_status[server_name] = False
        
        return health_status
    
    async def shutdown(self) -> None:
        """Shutdown the MCP manager and all servers"""
        logger.info("Shutting down Global MCP Manager")
        
        # Unregister from configuration changes
        config_manager.remove_observer(self._on_config_change)
        
        # Stop all servers
        await self._stop_servers()
        
        self._initialized = False
        logger.info("Global MCP Manager shutdown complete")

# Convenience function to get the global instance
async def get_mcp_manager() -> GlobalMCPManager:
    """Get the global MCP manager instance"""
    return await GlobalMCPManager.get_instance()
