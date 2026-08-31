import datetime
from fastapi import HTTPException
from engine.models import ContextFrame, SignalValue
from adapters.forecast_adapter import ForecastAdapter
from adapters.warning_adapter import WarningAdapter
from adapters.sun_adapter import SunAdapter
from adapters.aqi_adapter import AQIAdapter
from adapters.uv_adapter import UVAdapter

def build_context_frame(prefs: dict, lat: float, lon: float, when: datetime.datetime) -> ContextFrame:
    # 1. Compute time context
    # is_commute_window: 07:00–09:30 or 17:30–20:00 local time
    hour = when.hour
    minute = when.minute
    time_float = hour + (minute / 60.0)

    is_commute_window = (7.0 <= time_float <= 9.5) or (17.5 <= time_float <= 20.0)

    # 2-6. Call adapters
    t, h, w, p = ForecastAdapter().fetch(lat, lon, when)
    warnings = WarningAdapter().fetch(lat, lon, when)
    sr, ss = SunAdapter().fetch(lat, lon, when)
    aqi = AQIAdapter().fetch(lat, lon, when)
    uv = UVAdapter().fetch(lat, lon, when)

    # is_daylight
    is_daylight = True
    if sr.value and ss.value:
        try:
            # simple comparison assuming sr and ss are "HH:MM"
            srh, srm = map(int, sr.value.split(":"))
            ssh, ssm = map(int, ss.value.split(":"))
            sr_f = srh + srm / 60.0
            ss_f = ssh + ssm / 60.0
            is_daylight = (sr_f <= time_float <= ss_f)
        except Exception:
            pass
    personas = prefs.get("personas", ["default_general"])
    if not personas:
        personas = ["default_general"]
    has_declared_profile = "default_general" not in personas

    return ContextFrame(
        personas=personas,
        health_flags=prefs.get("health_flags", []),
        has_declared_profile=has_declared_profile,
        local_time=when.isoformat(),
        is_commute_window=is_commute_window,
        is_daylight=is_daylight,
        lat=lat,
        lon=lon,
        location_name="Unknown",
        temp_c=t,
        humidity_pct=h,
        wind_kmh=w,
        precip_prob_pct=p,
        warnings=warnings,
        aqi=aqi,
        uv=uv,
        sunrise=sr.value if sr.value else "06:00",
        sunset=ss.value if ss.value else "18:30"
    )
