#!/usr/bin/env python3
"""
Test the conversation adapter implementation
"""

import sys
import os
import unittest
from datetime import datetime

# Add the server directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from adapters.conversation_adapter import ConversationAdapter

class DummyPart:
    def __init__(self, part_kind: str, content: str, timestamp: datetime | None = None):
        self.part_kind = part_kind
        self.content = content
        self.timestamp = timestamp or datetime.now()

class DummyMessage:
    def __init__(self, parts):
        self.parts = parts

class TestConversationAdapter(unittest.TestCase):
    """Test cases for the conversation adapter"""

    def test_adapter_transformation_simple(self):
        conversation_id = "conv-abc"
        # Build a synthetic pydantic-ai like message sequence
        messages = [
            DummyMessage(parts=[
                DummyPart(part_kind="user-prompt", content="Hello world"),
            ]),
            DummyMessage(parts=[
                DummyPart(part_kind="text", content="Hi there!"),
            ]),
            DummyMessage(parts=[
                DummyPart(part_kind="thinking", content="Reasoning..."),
            ]),
        ]

        ui_messages = ConversationAdapter.transform_to_ui_messages(messages, conversation_id)
        # Should include user, assistant, and thinking messages
        types = [m["type"] for m in ui_messages]
        self.assertIn("user", types)
        self.assertIn("assistant", types)
        self.assertIn("thinking", types)
        # Validate structure
        for msg in ui_messages:
            self.assertIn("id", msg)
            self.assertIn("type", msg)
            self.assertIn("timestamp", msg)

    def test_preview_generation(self):
        # First user message text should be returned and truncated to 4 words by default
        messages = [
            DummyMessage(parts=[DummyPart("user-prompt", "one two three four five six")]),
            DummyMessage(parts=[DummyPart("text", "response")]),
        ]
        preview = ConversationAdapter.get_conversation_preview(messages)
        self.assertIsInstance(preview, str)
        self.assertEqual(preview, "one two three four...")

if __name__ == "__main__":
    print("🧪 Testing Conversation Adapter...")
    unittest.main(verbosity=2)
