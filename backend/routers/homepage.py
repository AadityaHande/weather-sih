from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Dict, Any
from collections import OrderedDict
import datetime
import time
import uuid
import pytz

from backend.db import get_connection
from backend.deps import build_context_frame
from engine.engine import rank
from engine.explain import _aqi_band, _uv_band
from backend.models_api import HomepageResponse, CardResponse, WarningResponse
import json

router = APIRouter()

# ----------------------------------------------------------------------------
# Explanation lookup store.
#
# Previously a plain dict that every /homepage call added ~8 entries to and
# never evicted -- an unbounded memory leak on a long-running server. This is
# a bounded, TTL-aware LRU: entries older than EXPLAIN_TTL_SECONDS are treated
# as expired, and the store never holds more than EXPLAIN_MAX_ENTRIES items
# (oldest evicted first). A context snapshot's explanations only need to
# survive as long as a user might plausibly still be viewing that homepage
# load, so 30 minutes / 5,000 entries is a generous, safe ceiling.
#
# Note: this remains in-process state, so it is only correct behind a single
# backend worker/replica. Running multiple workers/replicas requires moving
# this to the shared `signal_cache`-style store (Postgres/Redis) instead --
# tracked as a follow-up for horizontal scaling.
# ----------------------------------------------------------------------------
EXPLAIN_MAX_ENTRIES = 5000
EXPLAIN_TTL_SECONDS = 30 * 60


class _BoundedExplainStore:
    def __init__(self, max_entries: int, ttl_seconds: int):
        self._data: "OrderedDict[str, tuple[float, dict]]" = OrderedDict()
        self._max_entries = max_entries
        self._ttl_seconds = ttl_seconds

    def __setitem__(self, key: str, value: dict) -> None:
        self._data[key] = (time.monotonic(), value)
        self._data.move_to_end(key)
        while len(self._data) > self._max_entries:
            self._data.popitem(last=False)

    def __contains__(self, key: str) -> bool:
        entry = self._data.get(key)
        if entry is None:
            return False
        ts, _ = entry
        if time.monotonic() - ts > self._ttl_seconds:
            del self._data[key]
            return False
        return True

    def __getitem__(self, key: str) -> dict:
        if key not in self:  # also evicts if expired
            raise KeyError(key)
        return self._data[key][1]


explain_db = _BoundedExplainStore(EXPLAIN_MAX_ENTRIES, EXPLAIN_TTL_SECONDS)

def get_preferences(device_id: str) -> dict:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT personas, health_flags FROM preferences WHERE device_id = %s
                """, (device_id,))
                row = cur.fetchone()
                if row:
                    return {
                        "personas": json.loads(row[0]) if isinstance(row[0], str) else row[0],
                        "health_flags": json.loads(row[1]) if isinstance(row[1], str) else row[1]
                    }
    except Exception:
        pass

    from backend.db import _in_memory_prefs
    mem = _in_memory_prefs.get(device_id)
    if mem:
        return {
            "personas": mem.get("personas", ["default_general"]),
            "health_flags": mem.get("health_flags", [])
        }

    return {
        "personas": ["default_general"],
        "health_flags": []
    }


# ----------------------------------------------------------------------------
# Concise card headlines.
#
# The engine's `explanation_text` is a verbose, traceable "why this card was
# ranked" message -- great for the explanation drawer, wrong as a card summary.
# `value_summary` should be a short, human headline grounded in the same signal
# values, with no engine internals (priority labels, urgency multipliers,
# persona clauses). This helper derives exactly that, per card type, with a
# graceful fallback for unknown cards.
# ----------------------------------------------------------------------------

_AQI_GUIDANCE = {
    "Severe": "avoid outdoor exertion",
    "Poor": "limit outdoor exertion; sensitive groups should cut prolonged exposure",
    "Moderate": "sensitive groups should reduce prolonged outdoor activity",
    "Satisfactory": "air quality is fine",
    "unknown": "air quality data unavailable",
}

_UV_GUIDANCE = {
    "Extreme": "stay indoors around midday",
    "Very High": "use SPF 30+ and seek shade at midday",
    "High": "use SPF 30+ during midday hours",
    "Moderate/Low": "low-medium UV, minimal protection needed",
    "unknown": "UV data unavailable",
}


def _display_num(value) -> str:
    """Render a numeric signal value without a trailing '.0'."""
    if value is None:
        return "n/a"
    try:
        f = float(value)
        return str(int(f)) if f.is_integer() else str(round(f, 1))
    except (TypeError, ValueError):
        return str(value)


def _sig(refs: dict, key: str, suffix: str = "") -> str:
    """Formatted value for a signal, or 'n/a' when absent."""
    value = refs.get(key)
    if value is None:
        return "n/a"
    return f"{_display_num(value)}{suffix}"


def build_card_summary(rc, cf) -> str:
    """Short user-facing headline for a ranked card (never engine internals)."""
    refs = {sr.get("signal"): sr.get("value") for sr in rc.signal_refs}

    if rc.card_id == "severe_warning":
        w = cf.warnings[0] if cf.warnings else {}
        title = w.get("type") or "Severe weather"
        text = w.get("text")
        if text:
            return f"{title}: {text}"
        return f"{title} warning in effect"

    if rc.card_id == "aqi_health":
        band = _aqi_band(refs.get("aqi"))
        return f"AQI {_sig(refs, 'aqi')} ({band}) — {_AQI_GUIDANCE.get(band, _AQI_GUIDANCE['unknown'])}"

    if rc.card_id == "uv_sun_exposure":
        band = _uv_band(refs.get("uv"))
        return f"UV index {_sig(refs, 'uv')} ({band}) — {_UV_GUIDANCE.get(band, _UV_GUIDANCE['unknown'])}"

    if rc.card_id == "activity_window":
        return (
            f"{_sig(refs, 'temp_c', '°C')} · {_sig(refs, 'humidity_pct', '%')} humidity · "
            f"wind {_sig(refs, 'wind_kmh', ' km/h')} — good conditions for outdoor activity"
        )

    if rc.card_id == "rain_commute":
        window = " within your commute window" if cf.is_commute_window else ""
        return f"{_sig(refs, 'precip_prob_pct', '%')} chance of rain{window}"

    if rc.card_id == "sunrise_sunset":
        sunrise = refs.get("sunrise") or cf.sunrise or "n/a"
        sunset = refs.get("sunset") or cf.sunset or "n/a"
        return f"Sunrise {sunrise} · Sunset {sunset}"

    if rc.card_id == "general_conditions":
        return (
            f"Currently {_sig(refs, 'temp_c', '°C')} · {_sig(refs, 'humidity_pct', '%')} humidity · "
            f"wind {_sig(refs, 'wind_kmh', ' km/h')}"
        )

    if rc.card_id == "pollen_illustrative":
        return f"Pollen level {_sig(refs, 'pollen')}"

    # Unknown card type: fall back to the first clause of the verbose explanation.
    return rc.explanation_text.split(" — ")[0] if " — " in rc.explanation_text else rc.explanation_text


@router.get("/homepage", response_model=HomepageResponse)
async def homepage(
    device_id: str = Query(...),
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180)
):
    if not device_id.strip():
        raise HTTPException(status_code=422, detail="device_id required")

    prefs = get_preferences(device_id)
    now_ist = datetime.datetime.now(pytz.timezone("Asia/Kolkata"))

    # Assemble context via adapters
    cf = build_context_frame(prefs, lat, lon, now_ist)

    # Run the engine
    engine_output = rank(cf)

    ctx_id = uuid.uuid4().hex[:8]
    context_snapshot_id = f"ctx_{ctx_id}"

    # Format cards
    display_titles = {
        "severe_warning": "Severe Weather Warning",
        "aqi_health": "Air Quality",
        "uv_sun_exposure": "UV Index",
        "activity_window": "Activity Window",
        "rain_commute": "Rain & Commute",
        "sunrise_sunset": "Daylight Hours",
        "general_conditions": "General Conditions",
        "pollen_illustrative": "Pollen Levels"
    }

    cards = []
    for rc in engine_output.ranked_cards:
        exp_id = f"exp_{rc.card_id}_{ctx_id}"

        # Populate explanation DB
        explain_db[exp_id] = {
            "text": rc.explanation_text,
            "signal_refs": [{"signal": sr.get("signal", ""), "value": sr.get("value"), "source": sr.get("source", "simulated")} for sr in rc.signal_refs],
            "score_components": {
                "persona_weight": rc.score_components.get("persona_weight", 1.0),
                "urgency_multiplier": rc.score_components.get("urgency_multiplier", 1.0),
                "confidence_factor": rc.score_components.get("confidence_factor", 1.0)
            }
        }

        val_summary = build_card_summary(rc, cf)
        src = rc.signal_refs[0].get("source", "simulated") if rc.signal_refs else "simulated"

        badge_map = {
            "live": None,
            "simulated": "Simulated for demo",
            "cached": "Cached data",
            "unavailable": "Data temporarily unavailable",
            "stale": "Stale data"
        }
        freshness_badge = badge_map.get(src, None)

        c_res = CardResponse(
            card_id=rc.card_id,
            title=display_titles.get(rc.card_id, "Mausam Info"),
            priority=rc.priority,
            is_alert=rc.is_alert,
            value_summary=val_summary,
            source=src,
            freshness_badge=freshness_badge,
            explanation_ref=exp_id
        )
        cards.append(c_res)

    warnings_override = []
    for w_card in engine_output.override_warnings:
        w = w_card.signal_refs[0].get("value", {}) if w_card.signal_refs else {}
        if w:
            warnings_override.append(WarningResponse(
                severity=w.get("severity", "severe"),
                type=w.get("type", "Unknown"),
                text=w.get("text", "")
            ))

    # Identify if everything is unavailable
    # The engine guarantees at least one card (general_conditions) for fallback,
    # so we must check if all output sources are unavailable.
    all_unavailable = True
    if engine_output.override_warnings:
        all_unavailable = False
    else:
        for rc in engine_output.ranked_cards:
            if rc.card_id in ["sunrise_sunset", "general_conditions"]:
                continue
            if rc.signal_refs:
                for sr in rc.signal_refs:
                    if sr.get("source") != "unavailable":
                        all_unavailable = False
                        break

    system_notice = "All data sources unavailable. Displaying degraded view." if all_unavailable else None

    return HomepageResponse(
        context_snapshot_id=context_snapshot_id,
        generated_at=now_ist.isoformat(),
        cards=cards,
        warnings_override=warnings_override,
        system_notice=system_notice
    )
