"""
engine/scoring.py

Deterministic scoring pipeline for the Mausam personalization engine.

Pipeline per card:
    score = persona_weight × urgency_multiplier × confidence_factor

Each factor is computed by a dedicated, small, testable function.

Source of truth:
  - 03_personalization_logic_and_decision_matrix.md §4
  - 14_implementation_blueprint.md §3 (scoring.py block)
  - 15_implementation_completion_and_handoff.md §1 (all placeholders filled)

IMPORTANT: urgency_multiplier() must never read persona; it is purely a
function of environmental signals.  This independence is what proves the
engine is not just a persona lookup table (Risk R5 mitigation per 03_...md §4).
"""
from __future__ import annotations

from .models import ContextFrame, SignalValue

# ---------------------------------------------------------------------------
# Persona × Card weight table
# ---------------------------------------------------------------------------

# Full 8-card × 4-persona table.
# Values are design-quality placeholders consistent with 03_...md §3 scenario
# walkthrough and 15_...md §1.  Sanity-check against eval/run_spike.py before
# treating these as final/tuned.
#
# Interpretation: 0.0 = no relevance; 1.0 = maximum relevance.
# For cards where all personas have equal weight (e.g. severe_warning), the
# weight is 1.0 because P0 hard-rule bypasses scoring anyway — the weight
# is retained so explanation_text/score_components are never null.

PERSONA_WEIGHT: dict[tuple[str, str], float] = {
    # --- severe_warning ---------------------------------------------------
    # P0 hard-rule bypasses scoring; weights kept at 1.0 for all personas
    # so score_components are always populated (never null for explanations).
    ("severe_warning", "health"):          1.0,
    ("severe_warning", "fitness"):         1.0,
    ("severe_warning", "family"):          1.0,
    ("severe_warning", "beach"):           1.0,
    ("severe_warning", "traveler"):        1.0,
    ("severe_warning", "agriculture"):     1.0,
    ("severe_warning", "commuter"):        1.0,
    ("severe_warning", "event"):           1.0,
    ("severe_warning", "default_general"): 1.0,

    # --- aqi_health -------------------------------------------------------
    # Most relevant to health (respiratory) › commuter › default_general › fitness › traveler › agriculture › event › beach › family
    ("aqi_health", "health"):          0.9,
    ("aqi_health", "commuter"):        0.8,
    ("aqi_health", "default_general"): 0.6,
    ("aqi_health", "fitness"):         0.5,
    ("aqi_health", "traveler"):        0.6,
    ("aqi_health", "agriculture"):     0.5,
    ("aqi_health", "event"):           0.5,
    ("aqi_health", "beach"):           0.4,
    ("aqi_health", "family"):          0.4,

    # --- uv_sun_exposure --------------------------------------------------
    # Most relevant to beach › fitness › event › agriculture › health › traveler › default_general › family › commuter
    ("uv_sun_exposure", "beach"):           0.95,
    ("uv_sun_exposure", "fitness"):         0.9,
    ("uv_sun_exposure", "event"):           0.8,
    ("uv_sun_exposure", "agriculture"):     0.6,
    ("uv_sun_exposure", "health"):          0.6,
    ("uv_sun_exposure", "traveler"):        0.6,
    ("uv_sun_exposure", "default_general"): 0.4,
    ("uv_sun_exposure", "family"):          0.3,
    ("uv_sun_exposure", "commuter"):        0.4,

    # --- activity_window --------------------------------------------------
    # Primarily fitness & event & beach; others get moderate weight.
    ("activity_window", "fitness"):         0.95,
    ("activity_window", "event"):           0.9,
    ("activity_window", "beach"):           0.85,
    ("activity_window", "agriculture"):     0.7,
    ("activity_window", "traveler"):        0.5,
    ("activity_window", "commuter"):        0.4,
    ("activity_window", "health"):          0.3,
    ("activity_window", "default_general"): 0.3,
    ("activity_window", "family"):          0.25,

    # --- rain_commute -----------------------------------------------------
    # Agriculture & Commuter & Event & Family › Traveler › Beach › Fitness › General
    ("rain_commute", "agriculture"):     0.98,
    ("rain_commute", "commuter"):        0.98,
    ("rain_commute", "event"):           0.98,
    ("rain_commute", "family"):          0.95,
    ("rain_commute", "traveler"):        0.9,
    ("rain_commute", "beach"):           0.7,
    ("rain_commute", "fitness"):         0.6,
    ("rain_commute", "default_general"): 0.4,
    ("rain_commute", "health"):          0.3,

    # --- sunrise_sunset ---------------------------------------------------
    # Agriculture & Event & Traveler & Beach & Fitness.
    ("sunrise_sunset", "agriculture"):     0.8,
    ("sunrise_sunset", "event"):           0.75,
    ("sunrise_sunset", "traveler"):        0.7,
    ("sunrise_sunset", "beach"):           0.6,
    ("sunrise_sunset", "fitness"):         0.5,
    ("sunrise_sunset", "health"):          0.3,
    ("sunrise_sunset", "family"):          0.3,
    ("sunrise_sunset", "commuter"):        0.5,
    ("sunrise_sunset", "default_general"): 0.3,

    # --- general_conditions -----------------------------------------------
    # Traveler & Agriculture & Event & Commuter & Default General.
    ("general_conditions", "traveler"):        0.95,
    ("general_conditions", "agriculture"):     0.9,
    ("general_conditions", "event"):           0.9,
    ("general_conditions", "commuter"):        0.85,
    ("general_conditions", "default_general"): 0.7,
    ("general_conditions", "beach"):           0.6,
    ("general_conditions", "health"):          0.5,
    ("general_conditions", "fitness"):         0.5,
    ("general_conditions", "family"):          0.5,

    # --- pollen_illustrative ----------------------------------------------
    # Health & Agriculture opt-in
    ("pollen_illustrative", "health"):          0.4,
    ("pollen_illustrative", "agriculture"):     0.3,
    ("pollen_illustrative", "fitness"):         0.0,
    ("pollen_illustrative", "family"):          0.0,
    ("pollen_illustrative", "beach"):           0.0,
    ("pollen_illustrative", "traveler"):        0.0,
    ("pollen_illustrative", "commuter"):        0.0,
    ("pollen_illustrative", "event"):           0.0,
    ("pollen_illustrative", "default_general"): 0.0,
}

# --- Cold-start ordering sanity check -------------------------------------
# With baseline urgency=1.0 and confidence=1.0, default_general weights give:
#   severe_warning P0 override (not scored)
#   general_conditions  0.70 → 0.70
#   aqi_health          0.60 → 0.60
#   uv_sun_exposure     0.40 → 0.40
#   rain_commute        0.40 → 0.40  (tie — resolved by CARD_DEFINITION_ORDER)
#   activity_window     0.30 → 0.30
#   sunrise_sunset      0.30 → 0.30  (tie)
# This matches 15_...md §1 cold-start ordering check.


# ---------------------------------------------------------------------------
# confidence_factor
# ---------------------------------------------------------------------------

CONFIDENCE_BY_SOURCE: dict[str, float] = {
    "live":        1.0,
    "cached":      0.9,
    "simulated":   0.7,
    "stale":       0.3,
    "unavailable": 0.0,
}


def confidence_factor(signal: SignalValue) -> float:
    """
    Convert a signal's source tag into a 0–1 confidence multiplier.

    Live data is fully trusted; stale/simulated data naturally sinks in
    ranking rather than being hidden or causing a crash.

    Spec: 03_...md §4, 06_...md §4 (confidence table).
    """
    return CONFIDENCE_BY_SOURCE.get(signal.source, 0.0)


# ---------------------------------------------------------------------------
# urgency_multiplier — purely environmental, never persona-dependent
# ---------------------------------------------------------------------------

def _aqi_value(cf: ContextFrame) -> int | None:
    """Extract the integer AQI from the composite SignalValue dict."""
    v = cf.aqi.value
    if v is None:
        return None
    if isinstance(v, dict):
        return v.get("aqi")
    # Fallback: if stored as a bare number (should not happen per contract)
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def urgency_multiplier(card_id: str, cf: ContextFrame) -> float:
    """
    Compute how urgent a card is based purely on environmental signal values.

    This function must NEVER read cf.personas or cf.health_flags — that
    independence is what prevents personalization from degenerating into
    a simple persona lookup table (03_...md §4, Risk R5 mitigation).

    Returns a multiplier ≥ 1.0.  Higher = more urgent.

    Spec: 14_implementation_blueprint.md §3, 15_...md §1 (all 8 branches).
    """

    if card_id == "severe_warning":
        # Bypasses scoring entirely via P0 hard-rule (03_...md §5).
        # Returning 1.0 ensures score_components is always populated.
        return 1.0

    if card_id == "aqi_health":
        v = _aqi_value(cf)
        if v is None:
            return 1.0
        if v >= 300:
            return 2.5   # Severe / Hazardous
        if v >= 150:
            return 1.8   # Poor
        if v >= 100:
            return 1.3   # Moderate
        return 1.0       # Satisfactory / Good

    if card_id == "uv_sun_exposure":
        v = cf.uv.value
        if v is None:
            return 1.0
        v = float(v)
        if v >= 11:
            return 2.2   # Extreme
        if v >= 8:
            return 1.8   # Very High
        if v >= 6:
            return 1.2   # High
        return 1.0       # Moderate / Low

    if card_id == "activity_window":
        # Composite urgency: any bad condition affecting outdoor activity pushes UP.
        aqi_v = _aqi_value(cf)
        uv_v  = cf.uv.value
        temp_v = cf.temp_c.value
        wind_v = cf.wind_kmh.value

        bad = (
            (aqi_v  is not None and aqi_v  >= 150)
            or (uv_v   is not None and float(uv_v)   >= 8)
            or (temp_v is not None and (float(temp_v) >= 38 or float(temp_v) <= 5))
            or (wind_v is not None and float(wind_v) >= 40)
        )
        moderate = (
            (aqi_v  is not None and aqi_v  >= 100)
            or (uv_v   is not None and float(uv_v)   >= 6)
        )
        if bad:
            return 1.8
        if moderate:
            return 1.3
        return 1.0

    if card_id == "rain_commute":
        p = cf.precip_prob_pct.value
        if p is None:
            return 1.0
        p = float(p)
        # Commute window raises urgency because timing matters for shelter / transit decisions.
        #
        # IMPLEMENTATION CALIBRATION (2026-08-26, Milestone 1 Audit F-01):
        #   The original value here was 2.0 (a design-quality placeholder per 15_...md §1).
        #   The audit demonstrated that 0.95 (family weight) × 2.0 × 0.7 (simulated conf.) = 1.33,
        #   which is below the P1 threshold of 1.5 defined in 03_...md §5.
        #   This contradicted 03_...md §88 which requires Family + commute + rain → P1.
        #   Resolution: raised to 2.35.  Chosen value: 0.95 × 2.35 × 0.7 = 1.56275 ≥ 1.5 → P1.
        #   Persona weights, confidence levels, and P1_THRESHOLD are all UNCHANGED.
        #   This is an implementation-level calibration of a placeholder, not a spec change.
        #   See docs/IMPL_CALIBRATION_DECISIONS.md for full audit rationale.
        if cf.is_commute_window and p >= 60:
            return 2.35  # calibrated from 2.0 — see comment above
        if cf.is_commute_window and p >= 30:
            return 1.5
        if p >= 60:
            return 1.3   # High precip even outside commute hours
        return 1.0

    if card_id == "sunrise_sunset":
        # Informational only in the MVP; urgency never changes independently.
        return 1.0

    if card_id == "general_conditions":
        v = cf.temp_c.value
        if v is not None and (float(v) >= 40 or float(v) <= 5):
            return 1.3   # Heatwave- or coldwave-adjacent conditions
        return 1.0

    if card_id == "pollen_illustrative":
        # Simulated/illustrative only (13_...md); never independently alerted.
        return 1.0

    # Fallback for any unknown card_id (should never occur in prod).
    return 1.0


# ---------------------------------------------------------------------------
# score — the composite scoring function
# ---------------------------------------------------------------------------

def score(
    card_id: str,
    persona: str,
    cf: ContextFrame,
    primary_signal: SignalValue,
) -> tuple[float, dict]:
    """
    Compute the card's relevance score and return it alongside its components.

    Returns
    -------
    (score_value, score_components_dict)

    score_components_dict keys: "persona_weight", "urgency_multiplier",
                                "confidence_factor".
    Preserved so the explanation engine and tests can inspect each factor.

    Spec: 03_...md §4, 14_...md §3, 15_...md §1.
    """
    pw   = PERSONA_WEIGHT.get((card_id, persona), 0.2)
    um   = urgency_multiplier(card_id, cf)
    cfac = confidence_factor(primary_signal)
    raw  = pw * um * cfac
    return raw, {
        "persona_weight":       pw,
        "urgency_multiplier":   um,
        "confidence_factor":    cfac,
    }
