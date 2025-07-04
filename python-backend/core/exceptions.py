#!/usr/bin/env python3
"""
Custom exceptions for the MCP Chat application
"""

class MCPChatException(Exception):
    """Base exception for MCP Chat application"""
    pass

class ConfigurationError(MCPChatException):
    """Raised when there are configuration-related issues"""
    pass

class MCPServerError(MCPChatException):
    """Raised when there are MCP server-related issues"""
    pass

class ValidationError(MCPChatException):
    """Raised when input validation fails"""
    def __init__(self, message: str, errors: list[str] = None):
        super().__init__(message)
        self.errors = errors or []

class SettingsError(MCPChatException):
    """Raised when settings operations fail"""
    pass
