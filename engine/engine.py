"""
engine/engine.py

Public entrypoint for the Mausam Personalized Homepage engine.

The single public function is `rank(cf: ContextFrame) -> EngineOutput`.
This is a PURE function: same input always produces the same output.
There are NO network calls, NO database calls, NO filesystem reads here.

Source of truth:
  - 14_implementation_blueprint.md §3 (engine.py + all 5 helper names)
  - 15_implementation_completion_and_handoff.md §3 (all 5 helpers implemented)
  - 03_personalization_logic_and_decision_matrix.md §4–§13
  - 06_system_architecture.md §2 (module boundary rules)
"""
from __future__ import annotations

from .cards import CARD_DEFINITIONS, CARD_DEFINITION_ORDER
from .conflict import resolve_ties
from .explain import build_explanation
from .models import ContextFrame, EngineOutput, RankedCard, SignalValue, validate_context_frame
from .priority import apply_alert_priority_floor, classify_priority, is_alert
from .scoring import PERSONA_WEIGHT, score

# All persona tags the engine knows about.
_PERSONAS_ALL: frozenset[str] = frozenset(["health", "fitness", "family", "default_general"])


# ---------------------------------------------------------------------------
# Helper 1: _card_applies — missing-data + opt-in gating
# ---------------------------------------------------------------------------

def _card_applies(card_id: str, cf: ContextFrame) -> bool:
    """
    Determine whether a card is a candidate for this context.

    Returns False when:
    - the card's required signal is "unavailable" AND no safe default exists.
    - the card has special opt-in gating (pollen_illustrative).

    Source: 14_...md §3 (_card_applies) + 15_...md §3, 03_...md §10.
    """
    if card_id == "pollen_illustrative":
        # Gated: must have health persona + pollen_interest flag + pollen data.
        return (
            "health" in cf.personas
            and "pollen_interest" in cf.health_flags
            and cf.pollen is not None
            and cf.pollen.source != "unavailable"
        )

    if card_id == "severe_warning":
        return len(cf.warnings) > 0

    if card_id == "aqi_health":
        return cf.aqi.source != "unavailable"

    if card_id == "uv_sun_exposure":
        return cf.uv.source != "unavailable"

    if card_id == "rain_commute":
        return cf.precip_prob_pct.source != "unavailable"

    if card_id == "sunrise_sunset":
        # Locally computed; always available (08_...md §2).
        return True

    if card_id == "general_conditions":
        # Safe fallback — omit only if ALL of its inputs are unavailable.
        return not (
            cf.temp_c.source == "unavailable"
            and cf.humidity_pct.source == "unavailable"
            and cf.wind_kmh.source == "unavailable"
        )

    if card_id == "activity_window":
        # Composite — present if at least one input signal is available.
        return any(
            s.source != "unavailable"
            for s in [cf.temp_c, cf.wind_kmh, cf.aqi, cf.uv]
        )

    return True   # Unknown card: allow (defensive default).


# ---------------------------------------------------------------------------
# Helper 2: _primary_signal_for — confidence gateway per card
# ---------------------------------------------------------------------------

def _primary_signal_for(card_id: str, cf: ContextFrame) -> SignalValue:
    """
    Return the SignalValue whose confidence gates this card's score.

    For composite cards (activity_window, general_conditions) the weakest
    available signal is used so that partial data degradation is visible in
    the score, not hidden.

    Source: 15_...md §3 (_primary_signal_for).
    """
    if card_id == "aqi_health":
        return cf.aqi

    if card_id == "uv_sun_exposure":
        return cf.uv

    if card_id == "rain_commute":
        return cf.precip_prob_pct

    if card_id == "pollen_illustrative":
        # cf.pollen is checked for not-None in _card_applies before reaching here.
        return cf.pollen  # type: ignore[return-value]

    if card_id == "sunrise_sunset":
        # Always live (locally computed).
        return SignalValue(
            value=f"{cf.sunrise}/{cf.sunset}",
            source="live",
            freshness_min=0,
            confidence=1.0,
        )

    if card_id == "severe_warning":
        # Warnings are simulated in the MVP (13_...md). Confidence is always
        # treated as 1.0 for P0 override cards — alerts are never suppressed by
        # low confidence (03_...md §6), though the source badge still shows.
        return SignalValue(
            value=cf.warnings,
            source="simulated",
            freshness_min=0,
            confidence=1.0,
        )

    if card_id in ("activity_window", "general_conditions"):
        if card_id == "activity_window":
            group = [cf.temp_c, cf.wind_kmh, cf.aqi, cf.uv]
        else:
            group = [cf.temp_c, cf.humidity_pct, cf.wind_kmh]
        valid = [s for s in group if s.source != "unavailable"]
        if valid:
            # Weakest confidence in the group drives the card's overall confidence.
            return min(valid, key=lambda s: s.confidence)
        return group[0]   # All unavailable — return temp_c (engine will skip anyway)

    # Fallback to temperature as a safe default.
    return cf.temp_c


# ---------------------------------------------------------------------------
# Helper 3: _signal_refs_for — build NFR-1 traceable evidence list
# ---------------------------------------------------------------------------

def _signal_refs_for(card_id: str, cf: ContextFrame) -> list[dict]:
    """
    Build the list of {signal, value, source} dicts that the explanation for
    this card is ALLOWED to reference.

    This list is the checkable evidence behind NFR-1: every number mentioned
    in explanation_text must appear here, and every value here comes directly
    from the ContextFrame — nothing invented.

    Source: 15_...md §3 (_signal_refs_for), 07_...md §5 invariant.
    """
    def _ref(name: str, sig: SignalValue, extract=None):
        val = sig.value
        if extract is not None:
            val = extract(val)
        return {"signal": name, "value": val, "source": sig.source}

    def _aqi_val(v):
        if isinstance(v, dict):
            return v.get("aqi")
        return v

    if card_id == "aqi_health":
        return [_ref("aqi", cf.aqi, _aqi_val)]

    if card_id == "uv_sun_exposure":
        return [_ref("uv", cf.uv)]

    if card_id == "activity_window":
        return [
            _ref("temp_c",   cf.temp_c),
            _ref("wind_kmh", cf.wind_kmh),
            _ref("aqi",      cf.aqi, _aqi_val),
            _ref("uv",       cf.uv),
        ]

    if card_id == "rain_commute":
        return [_ref("precip_prob_pct", cf.precip_prob_pct)]

    if card_id == "sunrise_sunset":
        return [
            {"signal": "sunrise", "value": cf.sunrise, "source": "live"},
            {"signal": "sunset",  "value": cf.sunset,  "source": "live"},
        ]

    if card_id == "general_conditions":
        return [
            _ref("temp_c",       cf.temp_c),
            _ref("humidity_pct", cf.humidity_pct),
            _ref("wind_kmh",     cf.wind_kmh),
        ]

    if card_id == "pollen_illustrative":
        return [_ref("pollen", cf.pollen)]  # type: ignore[arg-type]

    if card_id == "severe_warning":
        return [
            {"signal": "warning", "value": w, "source": "simulated"}
            for w in cf.warnings
        ]

    return []


# ---------------------------------------------------------------------------
# Helper 4: _best_persona_for_card — multi-persona support
# ---------------------------------------------------------------------------

def _best_persona_for_card(card_id: str, personas: list[str]) -> str:
    """
    When the user has declared multiple personas (09_...md §1 S4 allows this),
    use whichever gives this specific card the HIGHEST weight.

    A health+fitness parent should see the AQI card at the health weight (0.9),
    not diluted by an average.

    Source: 15_...md §3 (_best_persona_for_card).
    """
    candidates = personas if personas else ["default_general"]
    return max(candidates, key=lambda p: PERSONA_WEIGHT.get((card_id, p), 0.2))


# ---------------------------------------------------------------------------
# Helper 5: _declared_ids — cards tied to the user's declared persona(s)
# ---------------------------------------------------------------------------

def _declared_ids(cf: ContextFrame) -> set[str]:
    """
    Return the set of card IDs that are directly tied to at least one of the
    user's explicitly declared (non-default) persona(s).

    Used only for conflict.py tie-break rule 3.
    Always empty for cold-start users (no declared profile).

    Source: 15_...md §3 (_declared_ids).
    """
    if not cf.has_declared_profile:
        return set()

    declared: set[str] = set()
    for card_id, definition in CARD_DEFINITIONS.items():
        relevant = definition.get("personas", [])
        if "*" in relevant:
            continue   # Universal card; not a distinguishing signal for tie-breaking.
        if any(p in relevant for p in cf.personas):
            declared.add(card_id)
    return declared


# ---------------------------------------------------------------------------
# Public API: rank()
# ---------------------------------------------------------------------------

def rank(cf: ContextFrame) -> EngineOutput:
    """
    The single public entrypoint of the personalization engine.

    Accepts a ContextFrame and returns a fully ranked EngineOutput.
    This is a PURE FUNCTION — no I/O, no side effects, deterministic.

    Algorithm:
    1. Validate the ContextFrame (raises ValueError on malformed input).
    2. For each card in CARD_DEFINITIONS:
       a. Check _card_applies (missing-data guard + opt-in gate).
       b. Select the best persona to score this card for.
       c. Compute score = persona_weight × urgency_multiplier × confidence_factor.
       d. Classify priority (P0 hard-rule overrides scoring).
       e. Determine alert status.
       f. Apply alert priority floor: if is_alert and priority==P3, raise to P2
          (03_...md §6 "never hidden"; see CAL-02 in docs/IMPL_CALIBRATION_DECISIONS.md).
       g. Build signal_refs and explanation_text.
    3. Resolve ties deterministically.
    4. Separate P0 override cards from the ranked list.
    5. Return EngineOutput.

    Raises
    ------
    ValueError
        If validate_context_frame() returns errors (malformed ContextFrame,
        not degraded data — 07_...md §4 distinguishes these explicitly).
    """
    errors = validate_context_frame(cf)
    if errors:
        raise ValueError(f"Invalid ContextFrame: {errors}")

    all_cards: list[RankedCard] = []

    for card_id in CARD_DEFINITIONS:
        # --- Gate check -------------------------------------------------------
        if not _card_applies(card_id, cf):
            continue

        # --- Scoring ----------------------------------------------------------
        best_persona   = _best_persona_for_card(card_id, cf.personas)
        primary_signal = _primary_signal_for(card_id, cf)
        score_val, components = score(card_id, best_persona, cf, primary_signal)

        # --- Priority + alert -------------------------------------------------
        priority  = classify_priority(card_id, score_val, cf)
        alert     = is_alert(card_id, priority, components["urgency_multiplier"], cf)
        # Apply F-02 alert visibility floor: never collapse an active alert to P3.
        # The raw score is preserved in score_val / components for full traceability.
        priority  = apply_alert_priority_floor(priority, alert)

        # --- Explanation tracing ----------------------------------------------
        refs        = _signal_refs_for(card_id, cf)
        explanation = build_explanation(card_id, priority, components, refs, cf)

        all_cards.append(RankedCard(
            card_id=card_id,
            priority=priority,
            is_alert=alert,
            score=round(score_val, 4),
            score_components=components,
            explanation_text=explanation,
            signal_refs=refs,
        ))

    # --- Tie-break sort -------------------------------------------------------
    sorted_cards = resolve_ties(all_cards, declared_persona_card_ids=_declared_ids(cf))

    # --- Separate P0 from ranked list ----------------------------------------
    override_warnings = [c for c in sorted_cards if c.priority == "P0"]
    ranked_cards       = [c for c in sorted_cards if c.priority != "P0"]

    return EngineOutput(
        ranked_cards=ranked_cards,
        override_warnings=override_warnings,
    )
