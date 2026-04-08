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

    import main
    import app.main as backend_main

    monkeypatch.setattr(main.ai_service, "is_configured", lambda: True)
    monkeypatch.setattr(main.ai_service, "get_client", lambda: type("MockClient", (), {"models": MockModels()})())
    monkeypatch.setattr(backend_main.ai_service, "is_configured", lambda: True)
    monkeypatch.setattr(backend_main.ai_service, "get_client", lambda: type("MockClient", (), {"models": MockModels()})())

    response = client.post("/api/chat", json={"user_id": "test_user", "message": "Hello"})

    assert response.status_code == 200
    assert response.json()["response"] == "I am a mocked response."


def test_memory_store_integration():
    memory_store.save_fact("integration_user", "Allergic to nuts")
    context = memory_store.get_context("integration_user")
    assert "Allergic to nuts" in context
