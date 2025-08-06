#!/usr/bin/env python3
"""
Test the conversation adapter implementation
"""

import asyncio
import sys
import os
import unittest

# Add the server directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adapters.conversation_adapter import ConversationAdapter
from core.database import init_db, get_conversation_history

class TestConversationAdapter(unittest.TestCase):
    """Test cases for the conversation adapter"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test database"""
        asyncio.run(init_db())
    
    def test_adapter_transformation(self):
        """Test the adapter transforms messages correctly"""
        async def run_test():
            conversations = await get_conversation_history(limit=1)
            
            if not conversations:
                self.skipTest("No conversations found in database")
            
            conversation = conversations[0]
            
            # Test the adapter transformation
            ui_messages = ConversationAdapter.transform_to_ui_messages(
                conversation['messages'], 
                conversation['conversation_id']
            )
            
            # Basic validation
            self.assertIsInstance(ui_messages, list)
            self.assertGreater(len(ui_messages), 0)
            
            # Check message structure
            for msg in ui_messages:
                self.assertIsInstance(msg, dict)
                self.assertIn('id', msg)
                self.assertIn('type', msg)
                self.assertIn('timestamp', msg)
        
        asyncio.run(run_test())
    
    def test_preview_generation(self):
        """Test preview generation works"""
        async def run_test():
            conversations = await get_conversation_history(limit=1)
            
            if not conversations:
                self.skipTest("No conversations found in database")
            
            conversation = conversations[0]
            
            # Test preview generation
            preview = ConversationAdapter.get_conversation_preview(conversation['messages'])
            
            self.assertIsInstance(preview, str)
            # Preview should be reasonably short
            self.assertLessEqual(len(preview.split()), 10)
        
        asyncio.run(run_test())

if __name__ == "__main__":
    print("🧪 Testing Conversation Adapter...")
    unittest.main(verbosity=2)
