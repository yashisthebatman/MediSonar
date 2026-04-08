import pytest
from fastapi.testclient import TestClient
from main import app, memory_store

client = TestClient(app)

def test_chat_integration(monkeypatch):
    class MockResponse:
        @property
        def text(self):
            return "I am a mocked response."
            
    class MockModels:
        def generate_content(self, model, contents, config=None):
            return MockResponse()
            
    class MockClient:
        def __init__(self, api_key):
            pass
        @property
        def models(self):
            return MockModels()
            
    import main
    monkeypatch.setattr(main, "GEMINI_API_KEY", "fake_key_for_testing")
    monkeypatch.setattr(main, "get_client", lambda: MockClient("fake_key"))
    
    response = client.post("/api/chat", json={
        "user_id": "test_user",
        "message": "Hello"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["response"] == "I am a mocked response."
    
def test_memory_store_integration():
    memory_store.save_fact("integration_user", "Allergic to nuts")
    context = memory_store.get_context("integration_user")
    assert "Allergic to nuts" in context
