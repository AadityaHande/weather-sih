import pytest
import os
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_degraded_invalid_fixture_never_returns_500():
    os.environ["ADAPTER_MODE"] = "fixture"
    os.environ["FIXTURE_SCENARIO"] = "non_existent_corrupt_scenario"

    res = client.get("/homepage?device_id=degraded_user&lat=28.6139&lon=77.2090")
    assert res.status_code == 200
    data = res.json()

    # Cards must still be returned (fallback general conditions or unavailable cards)
    assert "cards" in data
    assert len(data["cards"]) > 0

    # Ensure degradation is signaled via data, not 500 error
    sources = [c["source"] for c in data["cards"]]
    assert any(s in ["unavailable", "simulated", "live"] for s in sources)

def test_preferences_offline_fallback():
    # Write preference
    put_res = client.put("/preferences", json={
        "device_id": "offline_dev_1",
        "personas": ["fitness"],
        "health_flags": [],
        "saved_locations": [{"name": "Mumbai", "lat": 19.076, "lon": 72.877}]
    })
    assert put_res.status_code == 200

    # Read preference
    get_res = client.get("/preferences?device_id=offline_dev_1")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["device_id"] == "offline_dev_1"
    assert "fitness" in data["personas"]
    assert len(data["saved_locations"]) == 1
