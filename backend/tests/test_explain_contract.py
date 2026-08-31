import pytest
import os
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_explain_404_on_missing_ref():
    res = client.get("/explain?explanation_ref=exp_non_existent_999")
    assert res.status_code == 404

def test_explain_valid_resolution_and_traceability():
    os.environ["ADAPTER_MODE"] = "fixture"
    os.environ["FIXTURE_SCENARIO"] = "normal"

    # Fetch homepage first to populate explanations
    hp_res = client.get("/homepage?device_id=explain_test_dev&lat=28.6139&lon=77.2090")
    assert hp_res.status_code == 200
    cards = hp_res.json()["cards"]
    assert len(cards) > 0

    first_card = cards[0]
    exp_ref = first_card["explanation_ref"]

    # Call /explain with explanation_ref
    exp_res = client.get(f"/explain?explanation_ref={exp_ref}")
    assert exp_res.status_code == 200
    data = exp_res.json()

    # Verify explain contract
    assert data["explanation_ref"] == exp_ref
    assert isinstance(data["text"], str)
    assert len(data["text"]) > 0
    assert "signal_refs" in data
    assert isinstance(data["signal_refs"], list)
    assert "score_components" in data
    assert "persona_weight" in data["score_components"]
    assert "urgency_multiplier" in data["score_components"]
    assert "confidence_factor" in data["score_components"]

    # NFR-1 Traceability: Signal refs have valid signal name and source
    for sr in data["signal_refs"]:
        assert "signal" in sr
        assert "source" in sr
