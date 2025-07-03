from pydantic_settings import BaseSettings
from typing import Dict, Any
from settings import settings_manager

class AppConfig(BaseSettings):
    # OpenAI model name for the agent
    model_name: str = "openai:gpt-4o-mini"
    # Timeout (seconds) for user tool-approval workflows
    approval_timeout: float = 60.0
    # MCP servers configuration: mapping server name to command and args
    mcp_servers: Dict[str, Dict[str, Any]] = {
        "desktop-commander": {
            "command": "npx",
            "args": ["-y", "@wonderwhy-er/desktop-commander", "stdio"]
        },
        "context7": {
            "command": "npx",
            "args": ["-y", "@upstash/context7-mcp"]
        }
    }
    # System prompt for the AI agent
    system_prompt: str = "You are a helpful AI assistant."

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    async def load_from_settings_file(self):
        """Load configuration from settings file"""
        file_settings = await settings_manager.load_settings()
        self.model_name = file_settings.get("model_name", self.model_name)
        self.approval_timeout = file_settings.get("approval_timeout", self.approval_timeout)
        self.mcp_servers = file_settings.get("mcp_servers", self.mcp_servers)
        self.system_prompt = file_settings.get("system_prompt", self.system_prompt)

# Instantiate a global settings object
settings = AppConfig()
