#!/usr/bin/env python3
"""
MCP Agent Manager - Handles MCP servers and AI agent configuration
"""

import logging
import os
from typing import List, Any

from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio, CallToolFunc
from tool_approval import ToolApprovalManager
from config import settings

logger = logging.getLogger(__name__)

class MCPAgentManager:
    """Manages MCP servers and AI agent with human approval for tool execution"""
    
    def __init__(self, approval_manager: ToolApprovalManager, servers: list[MCPServerStdio] | None = None):
        self.approval_manager = approval_manager
        # Use provided servers or load from central config
        self.servers = servers if servers is not None else self._load_mcp_servers()
        self.agent = Agent(settings.model_name, mcp_servers=self.servers)
    
    def _load_mcp_servers(self) -> List[MCPServerStdio]:
        """Load MCP servers from configuration"""
        servers = []
        
        # Load servers from settings
        for server_name, config in settings.mcp_servers.items():
            try:
                # Expand environment variables in args
                expanded_args = []
                for arg in config["args"]:
                    if isinstance(arg, str):
                        expanded_args.append(os.path.expandvars(arg))
                    else:
                        expanded_args.append(arg)
                
                # Create MCP server instance
                server = MCPServerStdio(
                    config["command"],
                    args=expanded_args,
                    process_tool_call=self._process_tool_call
                )
                servers.append(server)
                logger.info(f"Loaded MCP server: {server_name}")
                
            except Exception as e:
                logger.error(f"Failed to load MCP server '{server_name}': {e}")
                # Continue loading other servers instead of failing completely
                continue
        
        return servers
    
    def get_agent(self) -> Agent:
        """Get the configured AI agent"""
        return self.agent

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
            logger.error(f"Error executing tool {tool_name}: {e}", exc_info=True)
            return f"Tool execution error: {str(e)}"
