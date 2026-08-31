import os
import datetime
from adapters.forecast_adapter import ForecastAdapter
from adapters.warning_adapter import WarningAdapter
from adapters.sun_adapter import SunAdapter

def test_forecast_fixture():
    os.environ["ADAPTER_MODE"] = "fixture"
    os.environ["FIXTURE_SCENARIO"] = "normal"
    now = datetime.datetime.now()
    adapter = ForecastAdapter()
    t, h, w, p = adapter.fetch(18.5, 73.8, now)
    assert t.source == "simulated"
    assert h.source == "simulated"
    assert t.confidence == 0.7

    os.environ["FIXTURE_SCENARIO"] = "invalid_scenario_file"
    t, h, w, p = adapter.fetch(18.5, 73.8, now)
    assert t.source == "unavailable"

def test_warning_fixture():
    os.environ["ADAPTER_MODE"] = "fixture"
    os.environ["FIXTURE_SCENARIO"] = "severe_warning"
    now = datetime.datetime.now()
    adapter = WarningAdapter()
    data = adapter.fetch(18.5, 73.8, now)
    assert isinstance(data, list)
    assert len(data) > 0

def test_sun_fixture():
    # Requires absolute coordinates math which depends on location
    now = datetime.datetime.now()
    adapter = SunAdapter()
    sr, ss = adapter.fetch(18.5, 73.8, now)
    assert sr.source == "live"
    assert sr.confidence == 1.0
