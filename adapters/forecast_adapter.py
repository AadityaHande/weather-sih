import datetime
import os
import requests
from adapters.base import Adapter
from engine.models import SignalValue

OPEN_METEO_FORECAST_URL = (
    "https://api.open-meteo.com/v1/forecast?"
    "latitude={lat}&longitude={lon}&"
    "current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,rain&"
    "hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,"
    "precipitation_probability,precipitation,rain,weather_code,pressure_msl,surface_pressure,"
    "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,evapotranspiration,"
    "vapour_pressure_deficit,wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_speed_180m,"
    "wind_direction_10m,wind_direction_80m,wind_direction_120m,wind_direction_180m,"
    "temperature_120m,temperature_180m,temperature_80m,soil_temperature_0cm,"
    "soil_temperature_6cm,soil_temperature_18cm,soil_temperature_54cm,soil_moisture_0_to_1cm,"
    "soil_moisture_1_to_3cm,soil_moisture_9_to_27cm,soil_moisture_3_to_9cm"
)

class ForecastAdapter(Adapter):
    def fetch(self, lat: float, lon: float, when: datetime.datetime):
        mode = os.getenv("ADAPTER_MODE", "live")
        if mode == "fixture":
            scenario = os.getenv("FIXTURE_SCENARIO", "normal")
            filepath = os.path.join(os.path.dirname(__file__), "fixtures", f"forecast_{scenario}.json")
            data = self.load_fixture(filepath)
            if not data:
                return (
                    self.make_unavailable_signal(),
                    self.make_unavailable_signal(),
                    self.make_unavailable_signal(),
                    self.make_unavailable_signal()
                )

            return (
                SignalValue(value=data.get("temp_c"), source="simulated", confidence=0.7, freshness_min=0),
                SignalValue(value=data.get("humidity_pct"), source="simulated", confidence=0.7, freshness_min=0),
                SignalValue(value=data.get("wind_kmh"), source="simulated", confidence=0.7, freshness_min=0),
                SignalValue(value=data.get("precip_prob_pct"), source="simulated", confidence=0.7, freshness_min=0)
            )

        # Full Open-Meteo Forecast API with user specified parameters.
        cached = self.get_fresh_cache("forecast", lat, lon, max_age_min=10)
        if cached is not None:
            cv = cached["value"]
            return (
                SignalValue(value=cv.get("temp"), source="cached", confidence=0.85, freshness_min=0),
                SignalValue(value=cv.get("humidity"), source="cached", confidence=0.85, freshness_min=0),
                SignalValue(value=cv.get("wind"), source="cached", confidence=0.85, freshness_min=0),
                SignalValue(value=cv.get("precip"), source="cached", confidence=0.85, freshness_min=0),
            )

        url = OPEN_METEO_FORECAST_URL.format(lat=lat, lon=lon)
        for attempt in range(2):
            try:
                res = requests.get(url, timeout=5.0)
                if res.status_code == 200:
                    body = res.json()
                    current = body.get("current", {})
                    temp = current.get("temperature_2m")
                    humidity = current.get("relative_humidity_2m")
                    wind = current.get("wind_speed_10m")

                    # precipitation_probability originates strictly from hourly block.
                    # It must be read at the hourly index that matches the "current"
                    # timestamp -- index 0 is simply the first hour of the returned
                    # window (typically the start of the day), so using it directly
                    # reported the wrong-time rain probability as "now".
                    precip = 0
                    hourly = body.get("hourly", {})
                    hourly_times = hourly.get("time", [])
                    prob_list = hourly.get("precipitation_probability", [])
                    current_time = current.get("time")

                    idx = 0
                    if current_time and hourly_times:
                        # Match on the hour (YYYY-MM-DDTHH); "current" is a precise
                        # timestamp while "hourly" entries fall exactly on the hour.
                        match = next(
                            (i for i, t in enumerate(hourly_times) if t[:13] == current_time[:13]),
                            None,
                        )
                        if match is not None:
                            idx = match

                    if prob_list and idx < len(prob_list):
                        precip = prob_list[idx]

                    self.set_cache(
                        "forecast", lat, lon,
                        {"temp": temp, "humidity": humidity, "wind": wind, "precip": precip},
                        "live", 0.9,
                    )
                    return (
                        SignalValue(value=temp, source="live", confidence=0.9, freshness_min=0),
                        SignalValue(value=humidity, source="live", confidence=0.9, freshness_min=0),
                        SignalValue(value=wind, source="live", confidence=0.9, freshness_min=0),
                        SignalValue(value=precip, source="live", confidence=0.9, freshness_min=0)
                    )
                break
            except Exception:
                continue

        # Live call failed after retry — prefer a stale cache entry over
        # jumping straight to simulated fixture data.
        stale = self.get_any_cache("forecast", lat, lon)
        if stale is not None:
            sv = stale["value"]
            return (
                SignalValue(value=sv.get("temp"), source="stale", confidence=0.5, freshness_min=None),
                SignalValue(value=sv.get("humidity"), source="stale", confidence=0.5, freshness_min=None),
                SignalValue(value=sv.get("wind"), source="stale", confidence=0.5, freshness_min=None),
                SignalValue(value=sv.get("precip"), source="stale", confidence=0.5, freshness_min=None),
            )

        # Fallback scenario
        scenario = os.getenv("FIXTURE_SCENARIO", "normal")
        filepath = os.path.join(os.path.dirname(__file__), "fixtures", f"forecast_{scenario}.json")
        data = self.load_fixture(filepath)
        if data:
            return (
                SignalValue(value=data.get("temp_c"), source="simulated", confidence=0.7, freshness_min=0),
                SignalValue(value=data.get("humidity_pct"), source="simulated", confidence=0.7, freshness_min=0),
                SignalValue(value=data.get("wind_kmh"), source="simulated", confidence=0.7, freshness_min=0),
                SignalValue(value=data.get("precip_prob_pct"), source="simulated", confidence=0.7, freshness_min=0)
            )

        return (
            self.make_unavailable_signal(),
            self.make_unavailable_signal(),
            self.make_unavailable_signal(),
            self.make_unavailable_signal()
        )
