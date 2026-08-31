import datetime
import os
import requests
from adapters.base import Adapter
from engine.models import SignalValue

class UVAdapter(Adapter):
    def fetch(self, lat: float, lon: float, when: datetime.datetime) -> SignalValue:
        mode = os.getenv("ADAPTER_MODE", "live")
        if mode == "fixture":
            filepath = os.path.join(os.path.dirname(__file__), "fixtures", "aqi_uv_recorded_samples.json")
            data = self.load_fixture(filepath)
            if data and "uv_index_sample" in data:
                return SignalValue(value=data["uv_index_sample"], source="simulated", confidence=0.7, freshness_min=0)
            return self.make_unavailable_signal()

        # Live Open-Meteo UV Index API path.
        cached = self.get_fresh_cache("uv", lat, lon, max_age_min=15)
        if cached is not None:
            return SignalValue(value=cached["value"], source="cached", confidence=0.85, freshness_min=0)

        url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=uv_index"
        for attempt in range(2):
            try:
                res = requests.get(url, timeout=4.0)
                if res.status_code == 200:
                    body = res.json()
                    current = body.get("current", {})
                    uv_val = current.get("uv_index")
                    if uv_val is not None:
                        uv_val = float(uv_val)
                        self.set_cache("uv", lat, lon, uv_val, "live", 0.9)
                        return SignalValue(value=uv_val, source="live", confidence=0.9, freshness_min=0)
                break
            except Exception:
                continue

        stale = self.get_any_cache("uv", lat, lon)
        if stale is not None:
            return SignalValue(value=stale["value"], source="stale", confidence=0.5, freshness_min=None)

        # Fallback to fixture
        filepath = os.path.join(os.path.dirname(__file__), "fixtures", "aqi_uv_recorded_samples.json")
        data = self.load_fixture(filepath)
        if data and "uv_index_sample" in data:
            return SignalValue(value=data["uv_index_sample"], source="simulated", confidence=0.7, freshness_min=0)

        return self.make_unavailable_signal()
