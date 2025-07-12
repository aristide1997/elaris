import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
import json

from conversation_db import (
    init_db,
    save_conversation,
    update_conversation,
    get_conversation_by_id,
    get_conversation_history,
    get_latest_conversation_messages,
    delete_conversation,
)
from conversation_db import DB_FILE
from pydantic_ai.messages import ModelMessagesTypeAdapter

class DummyUsage:
    def __init__(self):
        self.total_tokens = 10
        self.request_tokens = 5
        self.response_tokens = 5
        self.requests = 1

@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    # Redirect the DB file to a temporary path
    db_path = tmp_path / "test.db"
    monkeypatch.setattr("conversation_db.DB_FILE", str(db_path))
    # Stub out JSON serialization of messages
    monkeypatch.setattr(ModelMessagesTypeAdapter, "dump_json", lambda msgs: json.dumps(msgs).encode("utf-8"))
    return db_path

@pytest.mark.anyio
@pytest.mark.parametrize("anyio_backend", ["asyncio"])
async def test_conversation_crud():
    # Initialize database
    await init_db()

    # History should be empty at first
    history = await get_conversation_history()
    assert history == []
    assert await get_conversation_by_id("does_not_exist") is None

    # Save a new conversation
    conv_id = "conv-123"
    messages = [{"kind": "user-prompt", "content": "hello"}]
    usage = DummyUsage()
    returned_id = await save_conversation(conv_id, messages, usage, user_id="user1")
    assert returned_id == conv_id

    # Retrieve it back
    conv = await get_conversation_by_id(conv_id)
    assert conv["conversation_id"] == conv_id
    assert conv["messages"] == messages
    assert conv["usage_stats"]["total_tokens"] == usage.total_tokens

    # History should list it
    history = await get_conversation_history()
    assert len(history) == 1
    assert history[0]["conversation_id"] == conv_id

    # Latest messages
    latest = await get_latest_conversation_messages()
    assert latest == messages

    # Update the conversation
    new_messages = messages + [{"kind": "assistant", "content": "hi"}]
    await update_conversation(conv_id, new_messages, usage)
    updated = await get_conversation_by_id(conv_id)
    assert updated["messages"] == new_messages

    # Delete the conversation
    deleted = await delete_conversation(conv_id)
    assert deleted is True
    assert await get_conversation_by_id(conv_id) is None 