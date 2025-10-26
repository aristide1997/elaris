#!/usr/bin/env python3
"""
Agent Factory - Creates configured AI agents with MCP tools
"""

import logging
import os
from typing import Any, Callable

from pydantic_ai import Agent
from pydantic_ai.mcp import CallToolFunc
from services.approval_service import ApprovalService
from services.llm_provider_service import llm_provider_service, ProviderConfig
from core.config import config_manager
from services.mcp_service import get_mcp_manager
from core.exceptions import MCPServerError

logger = logging.getLogger(__name__)

class AgentFactory:
    """Factory for creating AI agents with current configuration"""
    
    async def create_agent(self, approval_service: ApprovalService) -> Agent:
        """Create a fresh agent with current configuration and enabled MCP servers"""
        try:
            config = await config_manager.load_config()

            # Inject JSON-based API keys into environment for pydantic-ai default providers
            llm_config = config["llm_provider"]
            provider_info = llm_provider_service.get_available_providers().get(llm_config["provider"])
            if provider_info:
                for field in provider_info.auth_fields:
                    env_var = field.get("env_var")
                    key = field["name"]
                    if env_var and key in llm_config["config"] and llm_config["config"][key]:
                        os.environ[env_var] = llm_config["config"][key]

            # Get LLM provider configuration
            provider_config = ProviderConfig(
                provider=llm_config["provider"],
                model=llm_config["model"],
                config=llm_config["config"],
                model_settings=llm_config.get("model_settings", {})
            )
            
            # Create provider instance using pydantic-ai
            provider_instance = llm_provider_service.create_provider_instance(provider_config)
            
            # Get smart model settings based on provider and model
            enable_thinking = config.get("enable_thinking", False)
            smart_model_settings = llm_provider_service.get_smart_model_settings(provider_config, enable_thinking)
            
            # Get only enabled MCP servers
            mcp_manager = await get_mcp_manager()
            servers = mcp_manager.get_enabled_servers()
            
            # Create tool interceptor for this approval service
            tool_interceptor = self._create_tool_interceptor(approval_service)
            
            # Set up process_tool_call for each server
            for server in servers:
                server.process_tool_call = tool_interceptor
            
            # Determine model argument: special-case Bedrock and Google GLA to pass provider instances
            if provider_config.provider == 'bedrock':
                from pydantic_ai.models.bedrock import BedrockConverseModel
                model_arg = BedrockConverseModel(
                    provider_config.model,
                    provider=provider_instance
                )
            elif provider_config.provider == 'google-gla':
                from pydantic_ai.providers.google import GoogleProvider
                from pydantic_ai.models.google import GoogleModel
                api_key = provider_config.config.get('api_key')
                google_provider = GoogleProvider(api_key=api_key)
                model_arg = GoogleModel(
                    provider_config.model,
                    provider=google_provider
                )
            else:
                model_arg = f"{provider_config.provider}:{provider_config.model}"

            # Create agent with configured model, smart model settings, and enabled servers
            agent_kwargs = {
                "model": model_arg,
                "mcp_servers": servers,
                "system_prompt": config["system_prompt"]
            }
            
            if smart_model_settings:
                agent_kwargs["model_settings"] = smart_model_settings
                logger.info(f"Applied model settings: {smart_model_settings}")
            
            agent = Agent(**agent_kwargs)
            
            logger.info(f"Created agent with provider '{provider_config.provider}', model '{provider_config.model}', and {len(servers)} enabled servers")
            return agent
            
        except Exception as e:
            logger.error(f"Failed to create agent: {e}", exc_info=True)
            raise MCPServerError(f"Agent creation failed: {e}")
    
    def _create_tool_interceptor(self, approval_service: ApprovalService) -> Callable:
        """Create a tool interceptor function for this approval service"""
        
        async def process_tool_call(
            ctx: Any, call_tool: CallToolFunc, tool_name: str, args: dict[str, Any]
        ) -> Any:
            """Interceptor for tool calls to enforce human approval"""
            approved = await approval_service.request_approval(tool_name, args)
            if not approved:
                return "Tool execution denied by user"
            
            try:
                result = await call_tool(tool_name, args)
                return result
            except Exception as e:
                logger.error(f"Error executing tool {tool_name}: {e}", exc_info=True)
                return f"Error occurred: {str(e)}"
        
        return process_tool_call
