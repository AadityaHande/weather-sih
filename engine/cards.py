"""
engine/cards.py

Registry of all 8 MVP homepage cards.

This is data, not logic — the engine reads this dictionary.
Adding a new card later only requires adding an entry here and the
corresponding weight, urgency, and explanation handlers in their modules.

Source of truth: 03_personalization_logic_and_decision_matrix.md §3,
                 14_implementation_blueprint.md §3 (cards.py block),
                 15_implementation_completion_and_handoff.md §0.3.
"""

# Each card definition:
#   personas         : list of persona tags this card is "relevant to",
#                      or ["*"] meaning all personas.
#   base_priority_floor : optional; "P0" for severe_warning bypasses scoring.
#   alertable        : if False, this card can NEVER become an alert even if
#                      urgency is high (pollen_illustrative is the only case).
#   required_signals : which ContextFrame fields must NOT be "unavailable" for
#                      this card to be a candidate.  Checked by _card_applies().
CARD_DEFINITIONS: dict[str, dict] = {
    "severe_warning": {
        "personas": ["*"],
        "base_priority_floor": "P0",
        "alertable": True,
        "required_signals": ["warnings"],   # non-empty list
        "description": "Severe weather warning — active override alert.",
    },
    "aqi_health": {
        "personas": ["health", "fitness", "commuter", "traveler", "agriculture", "event"],
        "alertable": True,
        "required_signals": ["aqi"],
        "description": "Air Quality Index and health guidance.",
    },
    "uv_sun_exposure": {
        "personas": ["health", "fitness", "beach", "event", "agriculture", "traveler"],
        "alertable": True,
        "required_signals": ["uv"],
        "description": "UV index and sun exposure guidance.",
    },
    "activity_window": {
        "personas": ["fitness", "beach", "event", "agriculture", "traveler"],
        "alertable": True,
        "required_signals": [],  # composite — at least one signal; handled in _card_applies
        "description": "Best outdoor activity window based on current conditions.",
    },
    "rain_commute": {
        "personas": ["family", "fitness", "commuter", "agriculture", "event", "traveler", "beach"],
        "alertable": True,
        "required_signals": ["precip_prob_pct"],
        "description": "Precipitation forecast and commute impact.",
    },
    "sunrise_sunset": {
        "personas": ["*"],
        "alertable": False,
        "required_signals": [],   # always available (locally computed)
        "description": "Sunrise and sunset times; daylight information.",
    },
    "general_conditions": {
        "personas": ["*"],         # fallback/cold-start card for all personas
        "alertable": False,
        "required_signals": [],   # composite; handled in _card_applies
        "description": "Current temperature, humidity, and wind conditions.",
    },
    "pollen_illustrative": {
        # GATED: only ever shown when:
        #   1. user declared the "health" or "agriculture" persona, AND
        #   2. "pollen_interest" is in health_flags, AND
        #   3. cf.pollen is not None.
        "personas": ["health", "agriculture"],
        "alertable": False,
        "required_signals": ["pollen"],
        "description": "Pollen level (illustrative / simulated, always disclosed).",
    },
}

# Stable ordering for conflict resolution tie-breaking (03_...md §8, rule 4).
# Earlier in this list = wins the tie.
CARD_DEFINITION_ORDER: list[str] = [
    "severe_warning",
    "aqi_health",
    "rain_commute",
    "uv_sun_exposure",
    "activity_window",
    "sunrise_sunset",
    "general_conditions",
    "pollen_illustrative",
]

assert set(CARD_DEFINITION_ORDER) == set(CARD_DEFINITIONS), (
    "CARD_DEFINITION_ORDER and CARD_DEFINITIONS must contain identical card IDs."
)
