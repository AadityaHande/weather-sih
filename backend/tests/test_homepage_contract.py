import pytest
import os
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_homepage_validation_errors():
    # Missing required query parameters
    res = client.get("/homepage")
    assert res.status_code == 422

    # Lat out of range
    res = client.get("/homepage?device_id=dev_1&lat=100.0&lon=77.2")
    assert res.status_code == 422

    # Lon out of range
    res = client.get("/homepage?device_id=dev_1&lat=28.6&lon=200.0")
    assert res.status_code == 422

def test_homepage_success_contract():
    os.environ["ADAPTER_MODE"] = "fixture"
    os.environ["FIXTURE_SCENARIO"] = "normal"
    res = client.get("/homepage?device_id=dev_test_001&lat=28.6139&lon=77.2090")
    assert res.status_code == 200
    data = res.json()

    # Verify top-level contract keys
    assert "context_snapshot_id" in data
    assert "generated_at" in data
    assert "cards" in data
    assert "warnings_override" in data

    assert isinstance(data["cards"], list)
    assert len(data["cards"]) > 0

    # Invariants on cards
    for card in data["cards"]:
        assert "card_id" in card
        assert "title" in card
        assert card["priority"] in ["P0", "P1", "P2", "P3"]
        assert isinstance(card["is_alert"], bool)
        assert isinstance(card["value_summary"], str)
        assert card["source"] in ["live", "simulated", "cached", "unavailable", "stale"]
        assert card["explanation_ref"] is not None
        assert card["explanation_ref"].startswith("exp_")

def test_homepage_persona_personalization():
    os.environ["ADAPTER_MODE"] = "fixture"
    os.environ["FIXTURE_SCENARIO"] = "normal"

    # Set health persona with respiratory sensitivity
    put_res = client.put("/preferences", json={
        "device_id": "health_user",
        "personas": ["health"],
        "health_flags": ["respiratory_sensitive"],
        "saved_locations": []
    })
    assert put_res.status_code == 200

    # Fetch homepage for health user
    res_health = client.get("/homepage?device_id=health_user&lat=28.6139&lon=77.2090")
    assert res_health.status_code == 200
    cards_health = [c["card_id"] for c in res_health.json()["cards"]]

    # Set general persona
    put_res = client.put("/preferences", json={
        "device_id": "general_user",
        "personas": ["default_general"],
        "health_flags": [],
        "saved_locations": []
    })
    assert put_res.status_code == 200

    # Fetch homepage for general user
    res_general = client.get("/homepage?device_id=general_user&lat=28.6139&lon=77.2090")
    assert res_general.status_code == 200
    cards_general = [c["card_id"] for c in res_general.json()["cards"]]

    assert len(cards_health) > 0
    assert len(cards_general) > 0
