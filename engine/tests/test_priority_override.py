"""
engine/tests/test_priority_override.py

Tests for P0 hard-rule override, alert logic, and priority thresholds.

These tests verify that:
- Severe warnings always surface to the top regardless of score.
- Alert classification is independent of persona.
- Priority thresholds produce the documented P1/P2/P3 bands.
- Deterministic repeated execution (same input → same output).
"""
import pytest

from engine.engine import rank
from engine.priority import P1_THRESHOLD, P2_THRESHOLD, classify_priority, is_alert
from engine.models import ContextFrame


class TestP0Override:
    def test_severe_warning_surfaces_to_override_warnings(self, cf_severe_warning):
        """P0 must ALWAYS appear in override_warnings, not in ranked_cards."""
        output = rank(cf_severe_warning)
        assert len(output.override_warnings) == 1
        assert output.override_warnings[0].card_id == "severe_warning"
        assert output.override_warnings[0].priority == "P0"

    def test_p0_not_in_ranked_cards(self, cf_severe_warning):
        output = rank(cf_severe_warning)
        ranked_ids = [c.card_id for c in output.ranked_cards]
        assert "severe_warning" not in ranked_ids

    def test_p0_overrides_any_score(self, cf_severe_warning):
        """P0 must win even if another card would score extremely high."""
        output = rank(cf_severe_warning)
        # All non-P0 cards must be in ranked_cards (priority ≠ P0)
        for card in output.ranked_cards:
            assert card.priority != "P0"

    def test_p0_is_alert(self, cf_severe_warning):
        output = rank(cf_severe_warning)
        assert output.override_warnings[0].is_alert is True

    def test_no_warnings_no_override(self, cf_health_moderate):
        """No active warnings → override_warnings must be empty."""
        output = rank(cf_health_moderate)
        assert output.override_warnings == []


class TestPriorityThresholds:
    def test_score_above_p1_threshold_is_p1(self):
        # P1_THRESHOLD = 1.5
        result = classify_priority("aqi_health", P1_THRESHOLD + 0.01,
                                   ContextFrame(
                                       personas=["health"], health_flags=[],
                                       has_declared_profile=True,
                                       local_time="2026-08-26T10:00:00+05:30",
                                       is_commute_window=False, is_daylight=True,
                                       lat=18.52, lon=73.86, warnings=[],
                                   ))
        assert result == "P1"

    def test_score_between_thresholds_is_p2(self):
        from engine.tests.conftest import _base
        cf = _base(personas=["health"])
        result = classify_priority(
            "aqi_health", (P1_THRESHOLD + P2_THRESHOLD) / 2, cf
        )
        assert result == "P2"

    def test_score_below_p2_threshold_is_p3(self):
        from engine.tests.conftest import _base
        cf = _base(personas=["health"])
        result = classify_priority("aqi_health", P2_THRESHOLD - 0.01, cf)
        assert result == "P3"


class TestAlertLogic:
    def test_high_aqi_health_persona_is_alert(self, cf_health_high_aqi):
        """Health persona + poor AQI should produce an AQI alert."""
        output = rank(cf_health_high_aqi)
        aqi_card = next(c for c in output.ranked_cards if c.card_id == "aqi_health")
        assert aqi_card.is_alert is True

    def test_pollen_never_alert(self, cf_pollen_opt_in):
        """pollen_illustrative must never trigger alert treatment."""
        output = rank(cf_pollen_opt_in)
        pollen_cards = [c for c in output.ranked_cards if c.card_id == "pollen_illustrative"]
        if pollen_cards:
            assert pollen_cards[0].is_alert is False

    def test_sunrise_sunset_never_alert(self, cf_fitness_good_conditions):
        output = rank(cf_fitness_good_conditions)
        ss_cards = [c for c in output.ranked_cards if c.card_id == "sunrise_sunset"]
        if ss_cards:
            assert ss_cards[0].is_alert is False


class TestDeterminism:
    def test_same_input_same_output_twice(self, cf_health_high_aqi):
        """Core requirement from 10_testing_and_validation_plan.md §1."""
        out1 = rank(cf_health_high_aqi)
        out2 = rank(cf_health_high_aqi)
        ids1 = [c.card_id for c in out1.ranked_cards]
        ids2 = [c.card_id for c in out2.ranked_cards]
        assert ids1 == ids2

    def test_same_input_same_scores(self, cf_health_high_aqi):
        out1 = rank(cf_health_high_aqi)
        out2 = rank(cf_health_high_aqi)
        scores1 = {c.card_id: c.score for c in out1.ranked_cards}
        scores2 = {c.card_id: c.score for c in out2.ranked_cards}
        assert scores1 == scores2
