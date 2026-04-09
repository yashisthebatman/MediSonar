from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from PIL import Image

from main import app, memory_store
from app.services.ai import GeminiService
from app.services.autism import _prepare_image, predict_autism_from_base64
from app.config import load_settings


client = TestClient(app)


def _mock_broken_client():
    class BrokenModels:
        def generate_content(self, model, contents, config=None):
            raise OSError("[WinError 10061] No connection could be made because the target machine actively refused it")

    return type("MockClient", (), {"models": BrokenModels()})()


def test_chat_returns_fallback_when_ai_service_is_unavailable(monkeypatch):
    import main
    import app.main as backend_main

    monkeypatch.setattr(main.ai_service, "is_configured", lambda: True)
    monkeypatch.setattr(main.ai_service, "get_client", _mock_broken_client)
    monkeypatch.setattr(backend_main.ai_service, "is_configured", lambda: True)
    monkeypatch.setattr(backend_main.ai_service, "get_client", _mock_broken_client)

    response = client.post("/api/chat", json={"user_id": "test_user", "message": "I have chest pain"})

    assert response.status_code == 200
    payload = response.json()
    assert "temporarily unavailable" in payload["response"]
    assert payload["memory_updates"] == []


def test_quota_errors_are_treated_as_temporary_service_failures():
    service = GeminiService(load_settings())
    exc = RuntimeError("429 RESOURCE_EXHAUSTED. Quota exceeded for metric")

    assert service.is_temporary_service_error(exc) is True
    assert "quota limit" in service.format_service_error("chat", exc)


def test_specialist_lookup_requires_explicit_user_request():
    service = GeminiService(load_settings())

    assert service.is_explicit_specialist_request("What could be causing this rash?") is False
    assert service.is_explicit_specialist_request("Connect me to a specialist near me") is True


def test_report_falls_back_to_local_summary_when_ai_service_is_unavailable(monkeypatch):
    import main
    import app.main as backend_main

    monkeypatch.setattr(main.ai_service, "is_configured", lambda: True)
    monkeypatch.setattr(main.ai_service, "get_client", _mock_broken_client)
    monkeypatch.setattr(backend_main.ai_service, "is_configured", lambda: True)
    monkeypatch.setattr(backend_main.ai_service, "get_client", _mock_broken_client)

    response = client.post(
        "/api/report",
        json={
            "messages": [{"role": "user", "content": "Headache for two days with light sensitivity"}],
            "health_profile": {"name": "Asha", "age": "29", "location": "Delhi"},
        },
    )

    assert response.status_code == 200
    assert "MEDISONAR - HEALTH CONSULTATION REPORT" in response.text
    assert "SERVICE NOTE" in response.text


def test_specialist_lookup_returns_error_payload_instead_of_500(monkeypatch):
    import main
    import app.main as backend_main

    monkeypatch.setattr(main.ai_service, "is_configured", lambda: True)
    monkeypatch.setattr(main.ai_service, "get_client", _mock_broken_client)
    monkeypatch.setattr(backend_main.ai_service, "is_configured", lambda: True)
    monkeypatch.setattr(backend_main.ai_service, "get_client", _mock_broken_client)

    response = client.post("/api/specialists", json={"disease": "flu", "location": "Delhi"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["specialists"] == []
    assert "temporarily unavailable" in payload["error"]


def test_reset_system_respects_individual_flags():
    memory_store.reset_all()
    memory_store.save_fact("reset_user", "Allergic to shellfish")
    memory_store.save_advisories_cache(
        "Delhi",
        "asthma",
        [{"title": "AQI Alert", "severity": "high", "description": "Use a mask"}],
        datetime.now(timezone.utc),
        datetime.now(timezone.utc) + timedelta(minutes=20),
    )

    response = client.post(
        "/api/system/reset",
        json={"clear_memory": False, "clear_advisories_cache": True},
    )

    assert response.status_code == 200
    assert response.json()["cleared_backend_db"] is True
    assert "Allergic to shellfish" in memory_store.get_context("reset_user")
    assert memory_store.get_advisories_cache("Delhi", "asthma") is None

    memory_store.reset_all()


def test_prepare_image_allows_low_detail_frames_with_quality_notes():
    image = Image.new("RGB", (256, 256), color=(220, 220, 220))
    processed, quality_notes = _prepare_image(image)

    assert processed.size[0] > 0
    assert any("reduce reliability" in note.lower() for note in quality_notes)


def test_autism_prediction_uses_binary_labels_without_inconclusive(monkeypatch):
    import torch

    class FakeModel:
        def eval(self):
            return self

        def __call__(self, tensor):
            return torch.tensor([0.12])

    def fake_transforms(image):
        return torch.zeros((3, 224, 224), dtype=torch.float32)

    monkeypatch.setattr("app.services.autism._load_artifacts", lambda: (torch, FakeModel(), fake_transforms))

    image = Image.new("RGB", (256, 256), color=(220, 220, 220))
    import base64
    import io

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

    result = predict_autism_from_base64(encoded)

    assert result["label"] in {"Autistic", "Non-autistic"}
    assert result["label"] == "Autistic"
