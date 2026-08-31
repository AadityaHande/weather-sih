import datetime
import os
import requests
from adapters.base import Adapter
from engine.models import SignalValue

class AQIAdapter(Adapter):
    def fetch(self, lat: float, lon: float, when: datetime.datetime) -> SignalValue:
        mode = os.getenv("ADAPTER_MODE", "live")
        if mode == "fixture":
            filepath = os.path.join(os.path.dirname(__file__), "fixtures", "aqi_uv_recorded_samples.json")
            data = self.load_fixture(filepath)
            if data and "aqi_sample" in data:
                return SignalValue(value=data["aqi_sample"], source="simulated", confidence=0.7, freshness_min=0)
            return self.make_unavailable_signal()

        # Live Open-Meteo Air Quality API path.
        # 1) Serve from cache if fresh (<15 min) — avoids hammering the
        #    upstream API on every single homepage request.
        cached = self.get_fresh_cache("aqi", lat, lon, max_age_min=15)
        if cached is not None:
            return SignalValue(value=cached["value"], source="cached", confidence=0.85, freshness_min=0)

        url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi"
        # 2) Live fetch with one retry on failure.
        for attempt in range(2):
            try:
                res = requests.get(url, timeout=4.0)
                if res.status_code == 200:
                    body = res.json()
                    current = body.get("current", {})
                    aqi_val = current.get("us_aqi")
                    if aqi_val is not None:
                        aqi_val = int(aqi_val)
                        self.set_cache("aqi", lat, lon, aqi_val, "live", 0.9)
                        return SignalValue(value=aqi_val, source="live", confidence=0.9, freshness_min=0)
                break  # non-200: no point retrying immediately
            except Exception:
                continue

        # 3) Live call failed — prefer a stale cache entry over simulated data.
        stale = self.get_any_cache("aqi", lat, lon)
        if stale is not None:
            return SignalValue(value=stale["value"], source="stale", confidence=0.5, freshness_min=None)

        # Fallback to fixture
        filepath = os.path.join(os.path.dirname(__file__), "fixtures", "aqi_uv_recorded_samples.json")
        data = self.load_fixture(filepath)
        if data and "aqi_sample" in data:
            return SignalValue(value=data["aqi_sample"], source="simulated", confidence=0.7, freshness_min=0)

        return self.make_unavailable_signal()
