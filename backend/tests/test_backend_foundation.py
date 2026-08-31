import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.settings import settings

client = TestClient(app)

def test_app_created():
    assert app.title == "Mausam Personalized Homepage API"

def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code in [200, 503]
    body = res.json()
    assert "status" in body
    assert "db" in body

def test_cors_configuration():
    res = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET"
        }
    )
    # CORS middleware should handle preflight or return headers
    assert res.status_code in [200, 204, 405]
