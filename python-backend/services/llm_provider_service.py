#!/usr/bin/env python3
"""
LLM Provider Service - Dynamic provider discovery and management using pydantic-ai
"""

import logging
import os
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Type
from dataclasses import dataclass, field

from pydantic_ai.providers import Provider, infer_provider_class, infer_provider
from core.exceptions import ConfigurationError

logger = logging.getLogger(__name__)

@dataclass
class ProviderInfo:
    """Information about an available LLM provider"""
    name: str
    display_name: str
    description: str
    auth_fields: List[Dict[str, Any]] = field(default_factory=list)
    supports_base_url: bool = False
    default_models: List[str] = field(default_factory=list)

@dataclass
class ProviderConfig:
    """Configuration for a specific provider instance"""
    provider: str
    model: str
    config: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ModelInfo:
    """Information about a model from OpenRouter"""
    id: str
    name: str
    provider: str
    context_length: Optional[int] = None
    pricing: Optional[Dict[str, str]] = None
    description: Optional[str] = None
    capabilities: Optional[List[str]] = None

class LLMProviderService:
    """Service for managing LLM providers dynamically using pydantic-ai infrastructure"""
    
    def __init__(self):
        self._provider_info_cache: Optional[Dict[str, ProviderInfo]] = None
        self._openrouter_models_cache: Optional[List[ModelInfo]] = None
        self._openrouter_cache_expiry: Optional[datetime] = None
        
        # Provider name mapping from OpenRouter model IDs to our internal provider names
        self._provider_mapping = {
            'openai': 'openai',
            'anthropic': 'anthropic',
            'meta-llama': 'meta',
            'mistralai': 'mistral',
            'google': 'google-gla',
            'deepseek': 'deepseek',
            'groq': 'groq',
            'cohere': 'cohere',
            'x-ai': 'grok',
            'openrouter': 'openrouter',
            'fireworks': 'fireworks',
            'together': 'together',
            'microsoft': 'azure'
        }
    
    def get_available_providers(self) -> Dict[str, ProviderInfo]:
        """Get information about all available providers"""
        if self._provider_info_cache is None:
            self._provider_info_cache = self._get_known_providers()
        return self._provider_info_cache.copy()
    
    def _get_known_providers(self) -> Dict[str, ProviderInfo]:
        """Get well-curated provider information"""
        providers = {}
        
        # Known providers with their metadata
        known_providers = [
            {
                'name': 'openai',
                'display_name': 'OpenAI',
                'description': 'OpenAI GPT models (GPT-4, GPT-3.5, etc.)',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'OPENAI_API_KEY', 'description': 'Your OpenAI API key'},
                    {'name': 'base_url', 'type': 'text', 'required': False, 'description': 'Custom API endpoint (optional)'}
                ],
                'supports_base_url': True,
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'anthropic', 
                'display_name': 'Anthropic',
                'description': 'Anthropic Claude models',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'ANTHROPIC_API_KEY', 'description': 'Your Anthropic API key'}
                ],
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'deepseek',
                'display_name': 'DeepSeek', 
                'description': 'DeepSeek AI models',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'DEEPSEEK_API_KEY', 'description': 'Your DeepSeek API key'}
                ],
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'groq',
                'display_name': 'Groq',
                'description': 'Groq fast inference models',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'GROQ_API_KEY', 'description': 'Your Groq API key'}
                ],
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'mistral',
                'display_name': 'Mistral AI',
                'description': 'Mistral AI models',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'MISTRAL_API_KEY', 'description': 'Your Mistral API key'}
                ],
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'cohere',
                'display_name': 'Cohere',
                'description': 'Cohere language models',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'CO_API_KEY', 'description': 'Your Cohere API key'}
                ],
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'google-gla',
                'display_name': 'Google Gemini (GLA)',
                'description': 'Google Generative Language AI (Gemini) models',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'GEMINI_API_KEY', 'description': 'Your Google GLA API key'}
                ],
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'bedrock',
                'display_name': 'AWS Bedrock',
                'description': 'AWS Bedrock models (Claude, Llama, etc.)',
                'auth_fields': [
                    {'name': 'region_name', 'type': 'text', 'required': False, 'default': 'us-east-1', 'description': 'AWS region (default: us-east-1)'},
                    {'name': 'aws_access_key_id', 'type': 'password', 'required': True, 'description': 'Your AWS Access Key ID'},
                    {'name': 'aws_secret_access_key', 'type': 'password', 'required': True, 'description': 'Your AWS Secret Access Key'},
                    {'name': 'aws_session_token', 'type': 'password', 'required': False, 'description': 'Your AWS session token (optional)'}
                ],
                'default_models': [
                    'anthropic.claude-3-5-sonnet-20241022-v2:0',
                    'anthropic.claude-3-5-sonnet-20240620-v1:0',
                    'anthropic.claude-3-5-haiku-20241022-v1:0',
                    'anthropic.claude-3-opus-20240229-v1:0',
                    'anthropic.claude-3-sonnet-20240229-v1:0',
                    'anthropic.claude-3-haiku-20240307-v1:0',
                    'meta.llama3-2-90b-instruct-v1:0',
                    'meta.llama3-2-11b-instruct-v1:0',
                    'meta.llama3-2-3b-instruct-v1:0',
                    'meta.llama3-2-1b-instruct-v1:0',
                    'meta.llama3-1-70b-instruct-v1:0',
                    'meta.llama3-1-8b-instruct-v1:0',
                    'mistral.mistral-large-2407-v1:0',
                    'mistral.mixtral-8x7b-instruct-v0:1',
                    'mistral.mistral-7b-instruct-v0:2'
                ]
            },
            {
                'name': 'azure',
                'display_name': 'Azure OpenAI',
                'description': 'Azure OpenAI Service',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'AZURE_OPENAI_API_KEY', 'description': 'Your Azure OpenAI API key'},
                    {'name': 'azure_endpoint', 'type': 'text', 'required': True, 'env_var': 'AZURE_OPENAI_ENDPOINT', 'description': 'Your Azure OpenAI endpoint URL'},
                    {'name': 'api_version', 'type': 'text', 'required': False, 'default': '2024-06-01', 'description': 'API version (default: 2024-06-01)'}
                ],
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'openrouter',
                'display_name': 'OpenRouter',
                'description': 'OpenRouter API (access to multiple models)',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'OPENROUTER_API_KEY', 'description': 'Your OpenRouter API key'}
                ],
                'supports_base_url': True,
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'grok',
                'display_name': 'Grok (X.AI)',
                'description': 'X.AI Grok models',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'XAI_API_KEY', 'description': 'Your X.AI API key'}
                ],
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'fireworks',
                'display_name': 'Fireworks AI',
                'description': 'Fireworks AI fast inference',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'FIREWORKS_API_KEY', 'description': 'Your Fireworks AI API key'}
                ],
                'default_models': []  # Models now loaded dynamically from OpenRouter
            },
            {
                'name': 'together',
                'display_name': 'Together AI',
                'description': 'Together AI inference platform',
                'auth_fields': [
                    {'name': 'api_key', 'type': 'password', 'required': True, 'env_var': 'TOGETHER_API_KEY', 'description': 'Your Together AI API key'}
                ],
                'default_models': []  # Models now loaded dynamically from OpenRouter
            }
        ]
        
        # Only include providers that are actually available in pydantic-ai
        for provider_data in known_providers:
            provider_name = provider_data['name']
            try:
                # Test if provider class exists
                provider_class = infer_provider_class(provider_name)
                
                providers[provider_name] = ProviderInfo(
                    name=provider_name,
                    display_name=provider_data['display_name'],
                    description=provider_data['description'],
                    auth_fields=provider_data['auth_fields'],
                    supports_base_url=provider_data.get('supports_base_url', False),
                    default_models=provider_data['default_models']
                )
                
                logger.debug(f"Added provider: {provider_name}")
                
            except (ValueError, ImportError) as e:
                logger.debug(f"Provider {provider_name} not available: {e}")
                continue
        
        logger.info(f"Loaded {len(providers)} available LLM providers")
        return providers
    
    def validate_provider_config(self, provider_config: ProviderConfig) -> List[str]:
        """Validate a provider configuration"""
        errors = []
        
        # Check if provider exists
        available_providers = self.get_available_providers()
        if provider_config.provider not in available_providers:
            errors.append(f"Unknown provider: {provider_config.provider}")
            return errors
        
        provider_info = available_providers[provider_config.provider]
        
        # Check required fields
        for field_info in provider_info.auth_fields:
            if field_info.get('required', False):
                field_name = field_info['name']
                if field_name not in provider_config.config or not provider_config.config[field_name]:
                    errors.append(f"Missing required field: {field_name}")
        
        # Validate model is specified
        if not provider_config.model:
            errors.append("Model name is required")
        
        return errors
    
    def create_provider_instance(self, provider_config: ProviderConfig) -> Provider:
        """Create a provider instance from configuration"""
        # Validate configuration first
        errors = self.validate_provider_config(provider_config)
        if errors:
            raise ConfigurationError(f"Invalid provider configuration: {', '.join(errors)}")
        
        try:
            # Get provider class
            provider_class = infer_provider_class(provider_config.provider)
            
            # Prepare initialization parameters
            init_params = {}
            
            # Add configuration parameters
            for key, value in provider_config.config.items():
                if value:  # Only add non-empty values
                    init_params[key] = value
            
            # Create provider instance
            provider_instance = provider_class(**init_params)
            
            logger.info(f"Created provider instance: {provider_config.provider}")
            return provider_instance
            
        except Exception as e:
            logger.error(f"Failed to create provider {provider_config.provider}: {e}", exc_info=True)
            raise ConfigurationError(f"Failed to create provider: {e}")
    
    def test_provider_connection(self, provider_config: ProviderConfig) -> Dict[str, Any]:
        """Test connection to a provider (basic validation)"""
        try:
            provider_instance = self.create_provider_instance(provider_config)
            
            # Basic validation - check if we can access provider properties
            name = provider_instance.name
            base_url = provider_instance.base_url
            
            return {
                'success': True,
                'provider_name': name,
                'base_url': base_url,
                'message': 'Provider connection test successful'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Provider connection test failed'
            }
    
    def get_provider_field_value(self, provider_name: str, field_name: str) -> Any:
        """Get the current value for a provider field (from env vars or defaults)"""
        providers = self.get_available_providers()
        if provider_name not in providers:
            return None
            
        provider_info = providers[provider_name]
        
        for field_info in provider_info.auth_fields:
            if field_info['name'] == field_name:
                # Check environment variable first
                env_var = field_info.get('env_var')
                if env_var and os.getenv(env_var):
                    return os.getenv(env_var)
                    
                # Return default if available
                return field_info.get('default')
        
        return None
    
    async def _fetch_openrouter_models(self) -> List[ModelInfo]:
        """Fetch all models from OpenRouter API"""
        try:
            import ssl
            # Create SSL context that doesn't verify certificates
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            connector = aiohttp.TCPConnector(ssl=ssl_context)
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(
                    'https://openrouter.ai/api/v1/models',
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_openrouter_models(data)
                    else:
                        logger.error(f"OpenRouter API returned status {response.status}")
                        return []
        except Exception as e:
            logger.error(f"Failed to fetch OpenRouter models: {e}", exc_info=True)
            return []
    
    def _parse_openrouter_models(self, data: Dict[str, Any]) -> List[ModelInfo]:
        """Parse OpenRouter API response into ModelInfo objects"""
        models = []
        
        for model_data in data.get('data', []):
            try:
                original_model_id = model_data.get('id', '')
                canonical_slug = model_data.get('canonical_slug', '')
                model_name = model_data.get('name', original_model_id)
                
                # Skip models that have suffixes in the model ID (like :free, :thinking, etc.)
                if ':' in original_model_id:
                    continue
                
                # Extract provider from model ID
                provider = self._extract_provider_from_model_id(original_model_id)
                
                # Strip provider prefix from model ID only for non-OpenRouter providers
                model_id = original_model_id
                if provider != 'openrouter' and '/' in model_id:
                    model_id = model_id.split('/', 1)[1]  # Remove provider prefix
                
                # Parse pricing
                pricing_data = model_data.get('pricing', {})
                pricing = {
                    'prompt': pricing_data.get('prompt', '0'),
                    'completion': pricing_data.get('completion', '0')
                }
                
                # Parse capabilities
                capabilities = []
                supported_params = model_data.get('supported_parameters', [])
                if supported_params:
                    capabilities.extend(supported_params)
                
                # Parse context length
                context_length = model_data.get('context_length')
                if context_length:
                    context_length = int(context_length)
                
                model_info = ModelInfo(
                    id=model_id,
                    name=model_name,
                    provider=provider,
                    context_length=context_length,
                    pricing=pricing,
                    description=model_data.get('description'),
                    capabilities=capabilities
                )
                
                models.append(model_info)
                
            except Exception as e:
                logger.warning(f"Failed to parse model {model_data.get('id', 'unknown')}: {e}")
                continue
        
        logger.info(f"Parsed {len(models)} models from OpenRouter (after filtering variants)")
        return models
    
    def _extract_provider_from_model_id(self, model_id: str) -> str:
        """Extract provider name from OpenRouter model ID"""
        if '/' in model_id:
            provider_prefix = model_id.split('/')[0]
            return self._provider_mapping.get(provider_prefix, provider_prefix)
        return 'openrouter'
    
    async def get_models_for_provider(self, provider_name: str) -> List[ModelInfo]:
        """Get models available for a specific provider"""
        # Get provider info to check for default models
        available_providers = self.get_available_providers()
        provider_info = available_providers.get(provider_name)
        
        # If provider has default models (like Bedrock), use those instead of OpenRouter
        if provider_info and provider_info.default_models:
            default_models = []
            for model_id in provider_info.default_models:
                model_info = ModelInfo(
                    id=model_id,
                    name=model_id,  # Use model ID as name for default models
                    provider=provider_name,
                    context_length=None,
                    pricing=None,
                    description=f"Default {provider_info.display_name} model",
                    capabilities=None
                )
                default_models.append(model_info)
            return default_models
        
        # For providers without default models, use OpenRouter data
        # Check if we need to refresh the cache
        now = datetime.now()
        if (self._openrouter_models_cache is None or 
            self._openrouter_cache_expiry is None or 
            now > self._openrouter_cache_expiry):
            
            logger.info("Fetching models from OpenRouter...")
            models = await self._fetch_openrouter_models()
            
            if models:
                self._openrouter_models_cache = models
                self._openrouter_cache_expiry = now + timedelta(hours=1)
                logger.info(f"Cached {len(models)} models from OpenRouter")
            else:
                logger.warning("Failed to fetch models from OpenRouter, using existing cache")
        
        # Use cached models or empty list if no cache
        all_models = self._openrouter_models_cache or []
        
        # Filter models by provider
        if provider_name == 'openrouter':
            # For OpenRouter provider, return all models
            return all_models
        else:
            # For other providers, filter by provider name
            filtered_models = [
                model for model in all_models 
                if model.provider == provider_name
            ]
            return filtered_models
    

# Global provider service instance
llm_provider_service = LLMProviderService()
