from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    """Verify that the basic API endpoints and FastAPI setup are functioning correctly."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"
    assert "api_key_configured" in data


def test_fingerprint_scan_endpoint(monkeypatch):
    def mock_scan_and_predict(serial_port, baud_rate, timeout_seconds, test_image_path=None):
        assert baud_rate == 57600
        assert timeout_seconds == 20
        return {
            "blood_group": "O-",
            "confidence": 98.25,
            "source": "scanner",
            "serial_port": serial_port or "COM3",
            "model": "mock-model.h5",
        }

    import main

    monkeypatch.setenv("FINGERPRINT_SERIAL_PORT", "COM3")
    monkeypatch.setattr(main, "scan_and_predict", mock_scan_and_predict)

    response = client.post("/api/fingerprint/scan", json={})

    assert response.status_code == 200
    data = response.json()
    assert data["blood_group"] == "O-"
    assert data["confidence"] == 98.25
    assert data["serial_port"] == "COM3"
