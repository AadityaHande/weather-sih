"""
engine/explain.py

Templated explanation generator for all 8 MVP cards.

Explanations are deterministic, grounded in actual signal_refs and
score_components values — never free-text, never LLM-generated.
This is the structural guarantee of NFR-1 (traceability) from
07_api_and_data_contracts.md §5.

Source of truth:
  - 03_personalization_logic_and_decision_matrix.md §13
  - 14_implementation_blueprint.md §3 (explain.py block)
  - 15_implementation_completion_and_handoff.md §2 (all 8 templates)
"""
from __future__ import annotations

from .models import ContextFrame

# ---------------------------------------------------------------------------
# Templates — one per card, total 8.
# Placeholders are filled with values from signal_refs and score_components;
# no value is ever invented outside those two sources.
# ---------------------------------------------------------------------------

EXPLANATION_TEMPLATES: dict[str, str] = {
    "severe_warning": (
        "{warning_text} — active {severity} warning → always shown first, "
        "regardless of your persona or preferences."
    ),
    "aqi_health": (
        "AQI {aqi_value} ({aqi_band}){persona_clause} — "
        "{urgency}× the normal urgency threshold → shown as {priority_label}."
    ),
    "uv_sun_exposure": (
        "UV index {uv_value} ({uv_band}){persona_clause} — "
        "{urgency}× the normal urgency threshold → shown as {priority_label}."
    ),
    "activity_window": (
        "Conditions: temp {temp_value}°C, wind {wind_value} km/h, "
        "AQI {aqi_value}, UV {uv_value}{persona_clause} → "
        "best outdoor window shifted, shown as {priority_label}."
    ),
    "rain_commute": (
        "{precip_value}% chance of rain{commute_clause} → shown as {priority_label}."
    ),
    "sunrise_sunset": (
        "Sunrise {sunrise_value}, sunset {sunset_value} → shown as {priority_label}."
    ),
    "general_conditions": (
        "Currently {temp_value}°C, {humidity_value}% humidity, "
        "wind {wind_value} km/h → shown as {priority_label}."
    ),
    "pollen_illustrative": (
        "Pollen level {pollen_value} [simulated for demo — illustrative only] "
        "→ shown as {priority_label}."
    ),
}

PRIORITY_LABEL: dict[str, str] = {
    "P0": "an override warning",
    "P1": "a high-priority alert",
    "P2": "a normal-priority item",
    "P3": "a low-priority / background item",
}


# ---------------------------------------------------------------------------
# Band helpers — translate raw numeric values to human-readable bands
# ---------------------------------------------------------------------------

def _aqi_band(value: int | None) -> str:
    if value is None:
        return "unknown"
    if value >= 300:
        return "Severe"
    if value >= 150:
        return "Poor"
    if value >= 100:
        return "Moderate"
    return "Satisfactory"


def _uv_band(value: float | None) -> str:
    if value is None:
        return "unknown"
    v = float(value)
    if v >= 11:
        return "Extreme"
    if v >= 8:
        return "Very High"
    if v >= 6:
        return "High"
    return "Moderate/Low"


def _fmt(value, unit: str = "") -> str:
    """Format a possibly-None value for display in an explanation string."""
    if value is None:
        return "unavailable"
    return f"{value}{unit}"


# ---------------------------------------------------------------------------
# Persona clause builder
# ---------------------------------------------------------------------------

def _persona_clause(cf: ContextFrame, persona_weight: float) -> str:
    """
    Returns a short clause appended to explanations when the user's declared
    persona materially increased this card's relevance.
    Empty string for cold-start or low-weight cases.
    """
    if not cf.has_declared_profile:
        return ""
    if persona_weight >= 0.6:
        return ", and this is particularly relevant to your declared persona"
    return ""


# ---------------------------------------------------------------------------
# Main public function
# ---------------------------------------------------------------------------

def build_explanation(
    card_id: str,
    priority: str,
    score_components: dict,
    signal_refs: list[dict],
    cf: ContextFrame,
) -> str:
    """
    Build a deterministic, template-based explanation for one ranked card.

    Parameters
    ----------
    card_id         : one of the 8 documented card IDs.
    priority        : "P0" | "P1" | "P2" | "P3".
    score_components: {"persona_weight", "urgency_multiplier", "confidence_factor"}.
    signal_refs     : [{"signal": str, "value": any, "source": str}, ...].
    cf              : full ContextFrame (used for derived context like commute flag).

    Returns a human-readable string that references only values present in
    signal_refs or score_components — never invents or hallucinates numbers.
    """
    template = EXPLANATION_TEMPLATES.get(card_id)
    if template is None:
        return f"Shown as {PRIORITY_LABEL.get(priority, priority)}."

    priority_label  = PRIORITY_LABEL.get(priority, priority)
    urgency         = round(score_components.get("urgency_multiplier", 1.0), 2)
    persona_weight  = score_components.get("persona_weight", 0.0)
    p_clause        = _persona_clause(cf, persona_weight)

    # Build a quick lookup from signal_refs for template substitution.
    refs = {r["signal"]: r["value"] for r in signal_refs}

    if card_id == "severe_warning":
        w = cf.warnings[0] if cf.warnings else {}
        return template.format(
            warning_text=w.get("text", "Severe weather warning"),
            severity=w.get("severity", "severe"),
        )

    if card_id == "aqi_health":
        raw_aqi = refs.get("aqi")
        return template.format(
            aqi_value=_fmt(raw_aqi),
            aqi_band=_aqi_band(raw_aqi),
            urgency=urgency,
            persona_clause=p_clause,
            priority_label=priority_label,
        )

    if card_id == "uv_sun_exposure":
        raw_uv = refs.get("uv")
        return template.format(
            uv_value=_fmt(raw_uv),
            uv_band=_uv_band(raw_uv),
            urgency=urgency,
            persona_clause=p_clause,
            priority_label=priority_label,
        )

    if card_id == "activity_window":
        raw_aqi = refs.get("aqi")
        return template.format(
            temp_value=_fmt(refs.get("temp_c")),
            wind_value=_fmt(refs.get("wind_kmh")),
            aqi_value=_fmt(raw_aqi),
            uv_value=_fmt(refs.get("uv")),
            persona_clause=p_clause,
            priority_label=priority_label,
        )

    if card_id == "rain_commute":
        commute_clause = " within your commute window" if cf.is_commute_window else ""
        return template.format(
            precip_value=_fmt(refs.get("precip_prob_pct")),
            commute_clause=commute_clause,
            priority_label=priority_label,
        )

    if card_id == "sunrise_sunset":
        return template.format(
            sunrise_value=refs.get("sunrise", cf.sunrise),
            sunset_value=refs.get("sunset", cf.sunset),
            priority_label=priority_label,
        )

    if card_id == "general_conditions":
        return template.format(
            temp_value=_fmt(refs.get("temp_c")),
            humidity_value=_fmt(refs.get("humidity_pct")),
            wind_value=_fmt(refs.get("wind_kmh")),
            priority_label=priority_label,
        )

    if card_id == "pollen_illustrative":
        return template.format(
            pollen_value=_fmt(refs.get("pollen")),
            priority_label=priority_label,
        )

    # Fallback (should never be reached in a correctly configured system).
    return f"Shown as {priority_label}."
