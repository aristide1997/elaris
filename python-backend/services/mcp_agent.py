#!/usr/bin/env python3
"""
MCP Agent Manager - Handles AI agent configuration with global MCP servers
"""

import logging
from typing import Any

from pydantic_ai import Agent
from pydantic_ai.mcp import CallToolFunc
from services.tool_approval import ToolApprovalManager
from services.llm_provider_service import llm_provider_service, ProviderConfig
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
            
            # Get LLM provider configuration
            llm_config = config["llm_provider"]
            provider_config = ProviderConfig(
                provider=llm_config["provider"],
                model=llm_config["model"],
                config=llm_config["config"]
            )
            
            # Create provider instance using pydantic-ai
            provider_instance = llm_provider_service.create_provider_instance(provider_config)
            
            # Get only enabled MCP servers
            mcp_manager = await get_mcp_manager()
            servers = mcp_manager.get_enabled_servers()
            
            # Set up process_tool_call for each server
            for server in servers:
                server.process_tool_call = self._process_tool_call
            
            # Determine model argument: special-case Bedrock and Google GLA to pass provider instances
            if provider_config.provider == 'bedrock':
                # Use BedrockConverseModel with the created BedrockProvider instance
                from pydantic_ai.models.bedrock import BedrockConverseModel
                model_arg = BedrockConverseModel(
                    provider_config.model,
                    provider=provider_instance
                )
            elif provider_config.provider == 'google-gla':
                # Use GoogleModel with a GoogleProvider built from the API key in config
                from pydantic_ai.providers.google import GoogleProvider
                from pydantic_ai.models.google import GoogleModel
                api_key = provider_config.config.get('api_key')
                google_provider = GoogleProvider(api_key=api_key)
                model_arg = GoogleModel(
                    provider_config.model,
                    provider=google_provider
                )
            else:
                # Use model spec string for other providers
                model_arg = f"{provider_config.provider}:{provider_config.model}"

            # Create agent with configured model and enabled servers
            agent = Agent(
                model_arg,
                mcp_servers=servers,
                system_prompt=config["system_prompt"]
            )
            
            logger.info(f"Created MCP Agent with provider '{provider_config.provider}', model '{provider_config.model}', and {len(servers)} enabled servers")
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
