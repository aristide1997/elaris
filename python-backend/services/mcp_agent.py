#!/usr/bin/env python3
"""
MCP Agent Manager - Handles AI agent configuration with global MCP servers
"""

import logging
from typing import Any

from pydantic_ai import Agent
from pydantic_ai.mcp import CallToolFunc
from services.tool_approval import ToolApprovalManager
from core.config import config_manager
from services.mcp_service import get_mcp_manager
from core.exceptions import MCPServerError

logger = logging.getLogger(__name__)

class MCPAgentManager:
    """Manages AI agent creation with human approval for tool execution using enabled MCP servers"""
    
    def __init__(self, approval_manager: ToolApprovalManager):
        self.approval_manager = approval_manager
    
    async def create_agent(self) -> Agent:
        """Create a fresh agent with current configuration and enabled MCP servers"""
        try:
            # Get current configuration
            config = await config_manager.load_config()
            
            # Get only enabled MCP servers
            mcp_manager = await get_mcp_manager()
            servers = mcp_manager.get_enabled_servers()
            
            # Set up process_tool_call for each server
            for server in servers:
                server.process_tool_call = self._process_tool_call
            
            # Create agent with configuration and enabled servers
            agent = Agent(
                config["model_name"], 
                mcp_servers=servers,
                system_prompt=config["system_prompt"]
            )
            
            logger.info(f"Created MCP Agent with {len(servers)} enabled servers")
            return agent
            
        except Exception as e:
            logger.error(f"Failed to create MCP Agent: {e}", exc_info=True)
            raise MCPServerError(f"Agent creation failed: {e}")
    

    async def _process_tool_call(
        self, ctx: Any, call_tool: CallToolFunc, tool_name: str, args: dict[str, Any]
    ) -> Any:
        """Interceptor for tool calls to enforce human approval"""
        # Ask user for approval
        approved = await self.approval_manager.request_approval(tool_name, args)
        if not approved:
            return "Tool execution denied by user"
        
        # Execute the actual tool
        try:
            result = await call_tool(tool_name, args)
            return result
        except Exception as e:
            # Log the error but format it as a normal response for the agent
            logger.error(f"Error executing tool {tool_name}: {e}", exc_info=True)
            # Return error information in a format similar to successful responses
            return f"Error occurred: {str(e)}"
