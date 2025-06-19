from pydantic_settings import BaseSettings
from typing import Dict, Any

class AppConfig(BaseSettings):
    # OpenAI model name for the agent
    model_name: str = "openai:gpt-4.1-mini"
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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Instantiate a global settings object
settings = AppConfig() 