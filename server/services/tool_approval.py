#!/usr/bin/env python3
"""
Tool Approval Manager - Handles tool execution approval workflow
"""

import asyncio
import uuid
import logging
from typing import Dict

from core.messaging import WebSocketMessenger
from core.config import config_manager

logger = logging.getLogger(__name__)

class ToolApprovalManager:
    """Manages tool execution approval workflow"""
    
    def __init__(self, messenger: WebSocketMessenger):
        self.messenger = messenger
        self.pending_approvals: Dict[str, asyncio.Future] = {}
    
    async def request_approval(self, tool_name: str, args: dict) -> bool:
        """Request user approval for tool execution"""
        # Check if auto-approval is enabled
        from core.config import config_manager
        auto_approve = await config_manager.get_value("auto_approve_tools", False)
        
        if auto_approve:
            logger.info(f"Auto-approving tool: {tool_name} (auto_approve_tools is enabled)")
            return True
        
        approval_id = str(uuid.uuid4())
        
        logger.info(f"Requesting approval for tool: {tool_name} with ID: {approval_id}")
        
        # Send approval request to client
        await self.messenger.send_message(
            "approval_request",
            approval_id=approval_id,
            tool_name=tool_name,
            args=args
        )
        
        # Create a future to wait for the response
        loop = asyncio.get_running_loop()
        approval_future = loop.create_future()
        self.pending_approvals[approval_id] = approval_future
        
        try:
            # Wait for approval response with timeout
            timeout = await config_manager.get_value("approval_timeout", 60.0)
            approved = await asyncio.wait_for(approval_future, timeout=timeout)  # configurable timeout
            logger.info(f"Approval received for {approval_id}: {approved}")
            return approved
        except asyncio.TimeoutError:
            logger.error(f"Approval timeout for tool: {tool_name}")
            return False
        except Exception as e:
            logger.error(f"Error waiting for approval: {e}")
            return False
        finally:
            # Clean up
            self.pending_approvals.pop(approval_id, None)
    
    async def handle_approval_response(self, approval_id: str, approved: bool):
        """Process approval response from the client"""
        logger.info(f"Received approval response for {approval_id}: {approved}")
        
        if approval_id in self.pending_approvals:
            future = self.pending_approvals[approval_id]
            if not future.done():
                future.set_result(approved)
                logger.info(f"Successfully set approval result for {approval_id}")
            else:
                logger.warning(f"Future already done for approval ID: {approval_id}")
        else:
            logger.warning(f"Received approval response for unknown ID: {approval_id}")
            logger.info(f"Current pending approvals: {list(self.pending_approvals.keys())}")
