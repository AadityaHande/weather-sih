"""
engine/tests/test_scoring.py

Tests for persona weights, urgency multipliers, confidence factors,
and the composite score() function.

Central claim being tested:
  "The engine must demonstrate more intelligence than a static generic
   homepage or a simple persona-specific hard filter."
  — Milestone 1 requirements

Specifically: urgency_multiplier changes independently of persona, and
persona_weight changes independently of environment, and their product
determines a meaningfully different ranking across all three personas.
"""
import pytest

from engine.models import ContextFrame, SignalValue
from engine.scoring import (
    PERSONA_WEIGHT,
    confidence_factor,
    score,
    urgency_multiplier,
)
from engine.tests.conftest import (
    aqi_live,
    live,
    simulated,
    stale,
    unavailable,
)


# ---------------------------------------------------------------------------
# confidence_factor tests
# ---------------------------------------------------------------------------

class TestConfidenceFactor:
    def test_live_is_full_confidence(self):
        sig = SignalValue(value=100, source="live", freshness_min=5, confidence=1.0)
        assert confidence_factor(sig) == pytest.approx(1.0)

    def test_cached_is_slightly_degraded(self):
        sig = SignalValue(value=100, source="cached", freshness_min=30, confidence=0.9)
        assert confidence_factor(sig) == pytest.approx(0.9)

    def test_simulated_is_moderate(self):
        sig = SignalValue(value=100, source="simulated", freshness_min=0, confidence=0.7)
        assert confidence_factor(sig) == pytest.approx(0.7)

    def test_stale_is_low(self):
        sig = SignalValue(value=100, source="stale", freshness_min=360, confidence=0.3)
        assert confidence_factor(sig) == pytest.approx(0.3)

    def test_unavailable_is_zero(self):
        sig = SignalValue(value=None, source="unavailable", freshness_min=None, confidence=0.0)
        assert confidence_factor(sig) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# PERSONA_WEIGHT table completeness
# ---------------------------------------------------------------------------

class TestPersonaWeightTable:
    ALL_CARDS = [
        "severe_warning", "aqi_health", "uv_sun_exposure", "activity_window",
        "rain_commute", "sunrise_sunset", "general_conditions", "pollen_illustrative",
    ]
    ALL_PERSONAS = ["health", "fitness", "family", "default_general"]

    def test_all_32_combinations_present(self):
        """All 8×4 = 32 pairs must be explicitly in the table."""
        missing = []
        for card in self.ALL_CARDS:
            for persona in self.ALL_PERSONAS:
                if (card, persona) not in PERSONA_WEIGHT:
                    missing.append((card, persona))
        assert missing == [], f"Missing PERSONA_WEIGHT entries: {missing}"

    def test_all_values_are_in_range(self):
        for (card, persona), weight in PERSONA_WEIGHT.items():
            assert 0.0 <= weight <= 1.0, (
                f"PERSONA_WEIGHT[({card!r}, {persona!r})] = {weight} is out of [0,1]"
            )

    def test_severe_warning_is_1_for_all_personas(self):
        for persona in self.ALL_PERSONAS:
            assert PERSONA_WEIGHT[("severe_warning", persona)] == pytest.approx(1.0)

    def test_aqi_health_persona_highest_weight(self):
        """Health persona should value AQI most."""
        assert PERSONA_WEIGHT[("aqi_health", "health")] > PERSONA_WEIGHT[("aqi_health", "fitness")]
        assert PERSONA_WEIGHT[("aqi_health", "health")] > PERSONA_WEIGHT[("aqi_health", "family")]

    def test_rain_commute_family_highest(self):
        """Family persona values rain/commute most."""
        assert PERSONA_WEIGHT[("rain_commute", "family")] > PERSONA_WEIGHT[("rain_commute", "fitness")]
        assert PERSONA_WEIGHT[("rain_commute", "family")] > PERSONA_WEIGHT[("rain_commute", "health")]

    def test_activity_window_fitness_highest(self):
        """Fitness persona values activity window most."""
        assert PERSONA_WEIGHT[("activity_window", "fitness")] > PERSONA_WEIGHT[("activity_window", "health")]
        assert PERSONA_WEIGHT[("activity_window", "fitness")] > PERSONA_WEIGHT[("activity_window", "family")]

    def test_uv_fitness_highest(self):
        assert PERSONA_WEIGHT[("uv_sun_exposure", "fitness")] > PERSONA_WEIGHT[("uv_sun_exposure", "health")]


# ---------------------------------------------------------------------------
# urgency_multiplier — environment-only, all 8 cards
# ---------------------------------------------------------------------------

class TestUrgencyMultiplier:
    """
    CRITICAL: urgency_multiplier must never read persona.
    Tests here verify the multiplier changes only with environmental values.
    """

    def _make_cf(self, **kwargs) -> ContextFrame:
        from engine.tests.conftest import _base
        return _base(personas=["health"], **kwargs)

    # AQI thresholds
    def test_aqi_good_is_1x(self):
        cf = self._make_cf(aqi=aqi_live(50))
        assert urgency_multiplier("aqi_health", cf) == pytest.approx(1.0)

    def test_aqi_moderate_is_1_3x(self):
        cf = self._make_cf(aqi=aqi_live(110))
        assert urgency_multiplier("aqi_health", cf) == pytest.approx(1.3)

    def test_aqi_poor_is_1_8x(self):
        cf = self._make_cf(aqi=aqi_live(160))
        assert urgency_multiplier("aqi_health", cf) == pytest.approx(1.8)

    def test_aqi_severe_is_2_5x(self):
        cf = self._make_cf(aqi=aqi_live(300))
        assert urgency_multiplier("aqi_health", cf) == pytest.approx(2.5)

    def test_aqi_unavailable_returns_1x(self):
        cf = self._make_cf(aqi=unavailable())
        assert urgency_multiplier("aqi_health", cf) == pytest.approx(1.0)

    # UV thresholds
    def test_uv_low_is_1x(self):
        cf = self._make_cf(uv=live(3.0))
        assert urgency_multiplier("uv_sun_exposure", cf) == pytest.approx(1.0)

    def test_uv_high_is_1_2x(self):
        cf = self._make_cf(uv=live(7.0))
        assert urgency_multiplier("uv_sun_exposure", cf) == pytest.approx(1.2)

    def test_uv_very_high_is_1_8x(self):
        cf = self._make_cf(uv=live(9.0))
        assert urgency_multiplier("uv_sun_exposure", cf) == pytest.approx(1.8)

    def test_uv_extreme_is_2_2x(self):
        cf = self._make_cf(uv=live(11.0))
        assert urgency_multiplier("uv_sun_exposure", cf) == pytest.approx(2.2)

    # Rain / commute
    def test_rain_commute_low_rain_outside_window(self):
        cf = self._make_cf(precip_prob_pct=simulated(20), is_commute=False)
        assert urgency_multiplier("rain_commute", cf) == pytest.approx(1.0)

    def test_rain_commute_high_rain_outside_window(self):
        cf = self._make_cf(precip_prob_pct=simulated(70), is_commute=False)
        assert urgency_multiplier("rain_commute", cf) == pytest.approx(1.3)

    def test_rain_commute_moderate_inside_window(self):
        cf = self._make_cf(precip_prob_pct=simulated(40), is_commute=True)
        assert urgency_multiplier("rain_commute", cf) == pytest.approx(1.5)

    def test_rain_commute_high_inside_window(self):
        cf = self._make_cf(precip_prob_pct=simulated(65), is_commute=True)
        # Urgency for commute window + ≥60% precip was 2.0 (placeholder per 15_...md §1).
        # Calibrated to 2.35 by Milestone 1 Audit finding F-01 (CAL-01).
        # See docs/IMPL_CALIBRATION_DECISIONS.md.
        assert urgency_multiplier("rain_commute", cf) == pytest.approx(2.35)

    # Activity window — composite
    def test_activity_bad_conditions_gives_1_8x(self):
        cf = self._make_cf(aqi=aqi_live(160), uv=live(9.0))
        assert urgency_multiplier("activity_window", cf) == pytest.approx(1.8)

    def test_activity_moderate_conditions_gives_1_3x(self):
        cf = self._make_cf(aqi=aqi_live(110), uv=live(4.0))
        assert urgency_multiplier("activity_window", cf) == pytest.approx(1.3)

    def test_activity_good_conditions_gives_1x(self):
        cf = self._make_cf(aqi=aqi_live(50), uv=live(3.0))
        assert urgency_multiplier("activity_window", cf) == pytest.approx(1.0)

    # Informational cards — always 1.0
    def test_sunrise_sunset_always_1x(self):
        cf = self._make_cf()
        assert urgency_multiplier("sunrise_sunset", cf) == pytest.approx(1.0)

    def test_severe_warning_always_1x(self):
        """P0 bypasses scoring; urgency_multiplier is irrelevant but must not crash."""
        cf = self._make_cf()
        assert urgency_multiplier("severe_warning", cf) == pytest.approx(1.0)

    def test_urgency_is_environment_only_not_persona(self):
        """
        The SAME environment must produce the SAME urgency regardless of persona.
        This directly tests Risk R5 mitigation.
        """
        from engine.tests.conftest import _base
        aqi = aqi_live(160)
        uv = live(9.0)
        for persona in ["health", "fitness", "family", "default_general"]:
            cf = _base(personas=[persona], aqi=aqi, uv=uv)
            assert urgency_multiplier("aqi_health", cf) == pytest.approx(1.8), (
                f"urgency_multiplier changed for persona={persona!r}"
            )


# ---------------------------------------------------------------------------
# score() — composite function
# ---------------------------------------------------------------------------

class TestScore:
    def _make_cf(self, **kwargs) -> ContextFrame:
        from engine.tests.conftest import _base
        return _base(personas=["health"], **kwargs)

    def test_score_returns_float_and_components(self):
        from engine.models import SignalValue
        cf = self._make_cf(aqi=aqi_live(96))
        primary = cf.aqi
        s, comps = score("aqi_health", "health", cf, primary)
        assert isinstance(s, float)
        assert "persona_weight" in comps
        assert "urgency_multiplier" in comps
        assert "confidence_factor" in comps

    def test_score_health_aqi_poor_is_high(self):
        """Health persona + high AQI should produce a score above P1 threshold (1.5)."""
        cf = self._make_cf(aqi=aqi_live(178))
        primary = cf.aqi
        s, _ = score("aqi_health", "health", cf, primary)
        # 0.9 × 1.8 × 1.0 = 1.62 — above P1 threshold
        assert s >= 1.5

    def test_score_family_aqi_is_lower_than_health(self):
        """Family persona should score AQI lower than health persona."""
        cf = self._make_cf(aqi=aqi_live(178))
        s_health, _ = score("aqi_health", "health", cf, cf.aqi)
        s_family, _ = score("aqi_health", "family", cf, cf.aqi)
        assert s_health > s_family

    def test_stale_signal_lowers_score(self):
        """Stale data must naturally sink in ranking via confidence_factor."""
        cf_live  = self._make_cf(aqi=aqi_live(178))
        cf_stale = self._make_cf(
            aqi=SignalValue({"aqi": 178, "dominant": "pm2.5"}, "stale", 360, 0.3)
        )
        s_live,  _ = score("aqi_health", "health", cf_live,  cf_live.aqi)
        s_stale, _ = score("aqi_health", "health", cf_stale, cf_stale.aqi)
        assert s_live > s_stale

    def test_unavailable_signal_produces_zero_score(self):
        cf = self._make_cf(aqi=unavailable())
        s, comps = score("aqi_health", "health", cf, cf.aqi)
        assert s == pytest.approx(0.0)
        assert comps["confidence_factor"] == pytest.approx(0.0)
