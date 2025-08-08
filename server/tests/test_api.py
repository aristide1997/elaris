import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
import json
import asyncio

from pydantic_ai.messages import ModelMessagesTypeAdapter
from core.database import init_db, save_conversation
from main import app
from fastapi.testclient import TestClient

# We will stub the UI transformation to keep API tests focused on routing/shape
from adapters.conversation_adapter import ConversationAdapter

class DummyUsage:
    def __init__(self):
        self.total_tokens = 10
        self.request_tokens = 5
        self.response_tokens = 5
        self.requests = 1

@pytest.fixture(autouse=True)
def temp_env(tmp_path, monkeypatch):
    # Redirect the DB file to a temporary path and stub JSON serialization
    db_path = tmp_path / "test.db"
    monkeypatch.setattr("core.database.DB_FILE", str(db_path))
    monkeypatch.setattr(ModelMessagesTypeAdapter, "dump_json", lambda msgs: json.dumps(msgs).encode("utf-8"))
    monkeypatch.setattr(ModelMessagesTypeAdapter, "validate_json", lambda s: json.loads(s))

    # Prevent startup from launching MCP servers
    async def fake_get_mcp_manager():
        class _Dummy:
            pass
        return _Dummy()
    monkeypatch.setattr("main.get_mcp_manager", fake_get_mcp_manager)

    return db_path


def test_api_conversation_crud(monkeypatch):
    # Initialize fresh database
    asyncio.get_event_loop().run_until_complete(init_db())

    # Pre-populate with one conversation (messages use dicts compatible with preview)
    conv_id = "conv-99"
    messages = [
        {"type": "user_prompt", "content": "hello"},
        {"type": "assistant", "content": "hi"}
    ]
    usage = DummyUsage()
    asyncio.get_event_loop().run_until_complete(
        save_conversation(conv_id, messages, usage, user_id="userX")
    )

    # Stub transform_to_ui_messages to a deterministic output
    stub_ui_messages = [
        {"id": "1", "type": "user", "timestamp": "t", "content": "hello"},
        {"id": "2", "type": "assistant", "timestamp": "t", "content": "hi"},
    ]
    monkeypatch.setattr(ConversationAdapter, "transform_to_ui_messages", lambda msgs, cid: stub_ui_messages)

    # Use TestClient to test HTTP endpoints synchronously
    with TestClient(app) as client:
        # List conversations
        r = client.get("/api/conversations")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "success"
        assert len(data["conversations"]) == 1
        item = data["conversations"][0]
        assert item["conversation_id"] == conv_id
        assert item["message_count"] == len(messages)
        # Preview should show first user prompt content
        assert item["preview"] == "hello"

        # Get by ID should return transformed messages
        r = client.get(f"/api/conversations/{conv_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "success"
        conv = d["conversation"]
        assert conv["conversation_id"] == conv_id
        assert conv["messages"] == stub_ui_messages

        # Delete conversation
        r = client.delete(f"/api/conversations/{conv_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "success"

        # List now empty
        r = client.get("/api/conversations")
        assert r.json()["conversations"] == []


def test_api_error_cases(monkeypatch):
    # Initialize database with no data
    asyncio.get_event_loop().run_until_complete(init_db())
    with TestClient(app) as client:
        # GET nonexistent conversation
        r = client.get("/api/conversations/nonexistent")
        assert r.status_code == 404
        # DELETE nonexistent conversation (API currently returns success regardless)
        r = client.delete("/api/conversations/nonexistent")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "success"


def test_ws_missing_conversation_id(tmp_path, monkeypatch):
    # Initialize database
    asyncio.get_event_loop().run_until_complete(init_db())

    # Prevent startup from launching MCP servers
    async def fake_get_mcp_manager():
        class _Dummy:
            pass
        return _Dummy()
    monkeypatch.setattr("main.get_mcp_manager", fake_get_mcp_manager)

    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            # On connect, receive system_ready
            msg = ws.receive_json()
            assert msg.get("type") == "system_ready"
            # Send chat without conversation_id
            ws.send_json({"type": "chat_message", "content": "hello"})
            err = ws.receive_json()
            assert err.get("type") == "error"
            assert err.get("message") == "Missing conversation_id" 