"""
engine/models.py

Data models for the Mausam Personalized Homepage engine.

These dataclasses form the contract between the data adapter layer and the
personalization engine. They must NOT import anything from fastapi, requests,
sqlite3, adapters, backend, or cache — the engine is a pure function module.

Source of truth: 07_api_and_data_contracts.md §1, 14_implementation_blueprint.md §3.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal


# ---------------------------------------------------------------------------
# Signal provenance
# ---------------------------------------------------------------------------

Source = Literal["live", "cached", "simulated", "stale", "unavailable"]
"""
Provenance/freshness of a single environmental signal.

live       — fetched successfully from a real API right now.
cached     — fetched recently; served from cache because live fetch failed.
simulated  — fixture/demo data; always disclosed on the UI.
stale      — cached but beyond the freshness threshold; score is penalised.
unavailable— no value at all (no live data, no cache, no safe default).
"""


@dataclass
class SignalValue:
    """
    A single environmental measurement with provenance metadata.

    Every environmental field in ContextFrame uses this shape.
    The engine reads `.source` and `.confidence` to down-weight degraded data
    without ever hiding the degradation from the UI.
    """
    value: float | int | str | dict | list | None
    """
    Scalar measurement, or a small dict for composite signals (e.g. AQI
    carries {"aqi": 178, "dominant": "pm2.5"}).
    None when source == "unavailable".
    """
    source: Source
    """Provenance; always non-None (required by 07_...md §5 invariant)."""
    freshness_min: int | None
    """Age of the reading in minutes. None when source == "unavailable"."""
    confidence: float
    """
    0.0–1.0.  Derived from freshness + source type:
      live=1.0, cached≈0.9, simulated≈0.7, stale≈0.3, unavailable=0.0
    The engine multiplies this in as confidence_factor; the UI can display it
    as a badge.  06_...md §4 "confidence illustrative values" table.
    """


# ---------------------------------------------------------------------------
# Context frame — the single input to rank()
# ---------------------------------------------------------------------------

@dataclass
class ContextFrame:
    """
    Complete snapshot of user + temporal + environmental context for one
    homepage render.  Built by the backend's deps.py, passed into the engine
    as-is.  The engine must not make any I/O calls; all data lives here.

    Spec: 07_api_and_data_contracts.md §1, 03_...md §2.
    """

    # ---- User / persona context ----------------------------------------
    personas: list[str]
    """
    e.g. ["health"], ["fitness"], ["family"], or ["default_general"]
    for cold-start.  Multi-persona is supported per 09_...md §1 S4.
    Never empty — cold-start uses ["default_general"].
    """
    health_flags: list[str]
    """
    e.g. ["respiratory_sensitive", "heat_sensitive"].
    Empty list for no declared flags or cold-start.
    """
    has_declared_profile: bool
    """False for a cold-start / new-user session."""

    # ---- Temporal context -----------------------------------------------
    local_time: str            # ISO 8601, e.g. "2026-08-26T18:40:00+05:30"
    is_commute_window: bool    # derived by backend from time + saved active-hours
    is_daylight: bool          # derived from sunrise/sunset

    # ---- Location -------------------------------------------------------
    lat: float
    lon: float
    location_name: str = "Unknown"

    # ---- Environmental signals ------------------------------------------
    # Each carries {value, source, freshness_min, confidence}; the engine
    # never modifies these — it only reads them.

    temp_c: SignalValue = field(
        default_factory=lambda: SignalValue(None, "unavailable", None, 0.0)
    )
    feels_like_c: SignalValue = field(
        default_factory=lambda: SignalValue(None, "unavailable", None, 0.0)
    )
    humidity_pct: SignalValue = field(
        default_factory=lambda: SignalValue(None, "unavailable", None, 0.0)
    )
    wind_kmh: SignalValue = field(
        default_factory=lambda: SignalValue(None, "unavailable", None, 0.0)
    )
    precip_prob_pct: SignalValue = field(
        default_factory=lambda: SignalValue(None, "unavailable", None, 0.0)
    )
    warnings: list[dict] = field(default_factory=list)
    """
    List of active severe-weather warnings.
    Each entry: {"severity": "red/orange/yellow", "type": str, "text": str}.
    Empty list = no active warnings.
    """
    aqi: SignalValue = field(
        default_factory=lambda: SignalValue(None, "unavailable", None, 0.0)
    )
    """
    value is a dict {"aqi": int, "dominant": str} when available,
    or None when unavailable.
    """
    uv: SignalValue = field(
        default_factory=lambda: SignalValue(None, "unavailable", None, 0.0)
    )
    pollen: SignalValue | None = None
    """
    None when pollen feature is entirely disabled.
    When present: SignalValue with source always "simulated".
    """
    sunrise: str = "06:00"    # HH:MM local time, locally computed (always "live")
    sunset: str = "18:30"     # HH:MM local time, locally computed (always "live")


# ---------------------------------------------------------------------------
# Engine output
# ---------------------------------------------------------------------------

@dataclass
class RankedCard:
    """
    A single scored and ranked card, output by the engine.
    Maps directly onto 07_api_and_data_contracts.md §3.
    """
    card_id: str
    """Matches a key in CARD_DEFINITIONS (engine/cards.py)."""
    priority: Literal["P0", "P1", "P2", "P3"]
    is_alert: bool
    score: float
    """Raw numeric score: persona_weight × urgency_multiplier × confidence_factor."""
    score_components: dict
    """
    {"persona_weight": float, "urgency_multiplier": float, "confidence_factor": float}
    Preserved for explanation generation and inspector/test use.
    """
    explanation_text: str
    """
    Templated explanation grounded in signal_refs values.
    Never LLM-generated, never free-text.
    """
    signal_refs: list[dict]
    """
    [{"signal": "aqi", "value": 178, "source": "live"}, ...]
    The checkable evidence behind NFR-1 traceability.
    """


@dataclass
class EngineOutput:
    """
    Full output of engine.rank().
    ranked_cards excludes P0 overrides (those are in override_warnings).
    """
    ranked_cards: list[RankedCard]
    """
    P1–P3 cards, sorted descending by effective priority then score.
    Frontend renders these as the scrollable card list.
    """
    override_warnings: list[RankedCard]
    """
    P0 cards only.  Frontend renders these *above* ranked_cards with a
    visual break — they never scroll away.
    """


# ---------------------------------------------------------------------------
# ContextFrame validation (pure function, no I/O)
# ---------------------------------------------------------------------------

def validate_context_frame(cf: ContextFrame) -> list[str]:
    """
    Validate the ContextFrame before passing it to rank().

    Returns a list of human-readable error strings.
    An empty list means the frame is valid.

    Spec: 14_implementation_blueprint.md §3 (ContextFrame validation block).
    The backend calls this and returns a 4xx on non-empty errors.
    Missing/stale data is NOT a validation error — that is a designed-for
    state, not an API-misuse case (07_...md §4).
    """
    errors: list[str] = []

    if not cf.personas:
        errors.append("personas must be non-empty; use ['default_general'] for cold-start")

    if not (-90 <= cf.lat <= 90):
        errors.append(f"lat out of range: {cf.lat}")

    if not (-180 <= cf.lon <= 180):
        errors.append(f"lon out of range: {cf.lon}")

    for sig_name, sig in [("aqi", cf.aqi), ("uv", cf.uv)]:
        if not (0.0 <= sig.confidence <= 1.0):
            errors.append(f"{sig_name}.confidence out of 0–1 range: {sig.confidence}")

    return errors
