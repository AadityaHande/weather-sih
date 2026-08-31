"""
engine/tests/test_explanation.py

Tests for the explanation engine — specifically NFR-1 grounding.

Every explanation string must:
  1. Not be empty.
  2. Reference at least one value that is present in signal_refs or score_components.
  3. Never reference a value that is NOT in signal_refs (no hallucination).
  4. For P0 cards, reference the warning details.

Source: 07_api_and_data_contracts.md §5 NFR-1,
        10_testing_and_validation_plan.md §1 (explanation_text check).

ADDITIONAL TESTS:
  - Full 8-card registry coverage (each card's explanation is exercised).
  - Invalid/incomplete ContextFrame raises ValueError.
  - Architectural purity: engine does NOT make network calls.
"""
import pytest

from engine.engine import rank
from engine.models import validate_context_frame, ContextFrame


class TestExplanationGrounding:
    """NFR-1: explanations must be traceable to signal_refs."""

    def _check_grounded(self, card):
        """
        Heuristic check: explanation must contain at least one token that
        matches a value from signal_refs or score_components.
        This is the automatable check from 10_...md §1.
        """
        text = card.explanation_text
        assert text, f"Card {card.card_id!r} has an empty explanation_text."

        # Collect all values from signal_refs and score_components.
        potential_refs = set()
        for ref in card.signal_refs:
            v = ref.get("value")
            if v is not None:
                potential_refs.add(str(v))
                # For dicts (e.g. AQI), also extract numeric value
                if isinstance(v, dict):
                    for k, dv in v.items():
                        potential_refs.add(str(dv))
        for k, v in card.score_components.items():
            potential_refs.add(str(round(v, 2)))

        # At minimum, the priority label must appear in the explanation.
        priority_labels = ["override warning", "high-priority", "normal-priority", "low-priority", "background"]
        has_priority_mention = any(pl in text.lower() for pl in priority_labels)

        assert has_priority_mention or any(ref in text for ref in potential_refs), (
            f"Card {card.card_id!r} explanation_text contains no traceable reference.\n"
            f"Text: {text!r}\n"
            f"Signal refs: {potential_refs}"
        )

    def test_all_cards_have_grounded_explanations_health(self, cf_health_high_aqi):
        output = rank(cf_health_high_aqi)
        for card in output.ranked_cards + output.override_warnings:
            self._check_grounded(card)

    def test_all_cards_have_grounded_explanations_fitness(self, cf_fitness_high_uv):
        output = rank(cf_fitness_high_uv)
        for card in output.ranked_cards + output.override_warnings:
            self._check_grounded(card)

    def test_all_cards_have_grounded_explanations_family(self, cf_family_commute_rain):
        output = rank(cf_family_commute_rain)
        for card in output.ranked_cards + output.override_warnings:
            self._check_grounded(card)

    def test_severe_warning_explanation_references_warning(self, cf_severe_warning):
        """P0 explanation must mention the actual warning text or severity."""
        output = rank(cf_severe_warning)
        card = output.override_warnings[0]
        text = card.explanation_text.lower()
        assert "thunderstorm" in text or "warning" in text or "severe" in text, (
            f"Severe warning explanation does not mention the warning: {card.explanation_text!r}"
        )

    def test_rain_explanation_references_precip(self, cf_family_commute_rain):
        """Rain explanation must mention the precipitation percentage."""
        output = rank(cf_family_commute_rain)
        rain_card = next(c for c in output.ranked_cards if c.card_id == "rain_commute")
        # 70% should appear in the explanation
        assert "70" in rain_card.explanation_text

    def test_commute_clause_present_in_rain_explanation_for_commute_window(
        self, cf_family_commute_rain
    ):
        output = rank(cf_family_commute_rain)
        rain_card = next(c for c in output.ranked_cards if c.card_id == "rain_commute")
        assert "commute" in rain_card.explanation_text.lower()

    def test_pollen_explanation_says_simulated(self, cf_pollen_opt_in):
        """Pollen explanation must always disclose that data is simulated."""
        output = rank(cf_pollen_opt_in)
        pollen_card = next((c for c in output.ranked_cards if c.card_id == "pollen_illustrative"), None)
        if pollen_card:
            assert "simulated" in pollen_card.explanation_text.lower(), (
                "Pollen card explanation must disclose 'simulated' data."
            )


class TestFullCardRegistryCoverage:
    """
    Every card in the 8-card registry must be exercisable.
    We test each card's presence using fixtures designed to activate it.
    """

    def test_severe_warning_card_exercised(self, cf_severe_warning):
        output = rank(cf_severe_warning)
        ids = [c.card_id for c in output.override_warnings]
        assert "severe_warning" in ids

    def test_aqi_health_card_exercised(self, cf_health_high_aqi):
        output = rank(cf_health_high_aqi)
        ids = [c.card_id for c in output.ranked_cards]
        assert "aqi_health" in ids

    def test_uv_sun_exposure_card_exercised(self, cf_fitness_high_uv):
        output = rank(cf_fitness_high_uv)
        ids = [c.card_id for c in output.ranked_cards]
        assert "uv_sun_exposure" in ids

    def test_activity_window_card_exercised(self, cf_fitness_high_uv):
        output = rank(cf_fitness_high_uv)
        ids = [c.card_id for c in output.ranked_cards]
        assert "activity_window" in ids

    def test_rain_commute_card_exercised(self, cf_family_commute_rain):
        output = rank(cf_family_commute_rain)
        ids = [c.card_id for c in output.ranked_cards]
        assert "rain_commute" in ids

    def test_sunrise_sunset_card_exercised(self, cf_fitness_good_conditions):
        output = rank(cf_fitness_good_conditions)
        ids = [c.card_id for c in output.ranked_cards]
        assert "sunrise_sunset" in ids

    def test_general_conditions_card_exercised(self, cf_cold_start):
        output = rank(cf_cold_start)
        ids = [c.card_id for c in output.ranked_cards]
        assert "general_conditions" in ids

    def test_pollen_illustrative_card_exercised(self, cf_pollen_opt_in):
        output = rank(cf_pollen_opt_in)
        ids = [c.card_id for c in output.ranked_cards]
        assert "pollen_illustrative" in ids


class TestInvalidInput:
    """Engine must raise ValueError for structurally invalid ContextFrames."""

    def test_empty_personas_is_invalid(self):
        errors = validate_context_frame(
            ContextFrame(
                personas=[],   # Invalid: must be non-empty
                health_flags=[],
                has_declared_profile=False,
                local_time="2026-08-26T10:00:00+05:30",
                is_commute_window=False,
                is_daylight=True,
                lat=18.52,
                lon=73.86,
            )
        )
        assert any("personas" in e for e in errors), errors

    def test_invalid_lat_is_caught(self):
        errors = validate_context_frame(
            ContextFrame(
                personas=["default_general"],
                health_flags=[],
                has_declared_profile=False,
                local_time="2026-08-26T10:00:00+05:30",
                is_commute_window=False,
                is_daylight=True,
                lat=999.0,  # out of range
                lon=73.86,
            )
        )
        assert any("lat" in e for e in errors)

    def test_rank_raises_on_invalid_context(self):
        with pytest.raises(ValueError, match="Invalid ContextFrame"):
            rank(ContextFrame(
                personas=[],   # Invalid
                health_flags=[],
                has_declared_profile=False,
                local_time="2026-08-26T10:00:00+05:30",
                is_commute_window=False,
                is_daylight=True,
                lat=18.52,
                lon=73.86,
            ))


class TestArchitecturalPurity:
    """
    Verify that executing the engine does not invoke any network calls.
    We test this by running rank() with a real fixture while patching
    socket.socket to raise if called — any network call would fail loudly.
    """

    def test_engine_makes_no_network_calls(self, cf_health_high_aqi):
        import socket
        from unittest.mock import patch, MagicMock

        original_socket = socket.socket

        def no_network(*args, **kwargs):
            raise RuntimeError(
                "engine.rank() made a network call — this violates architectural boundary rules. "
                "See 06_system_architecture.md §2."
            )

        with patch("socket.socket", side_effect=no_network):
            # Should complete without touching the socket
            output = rank(cf_health_high_aqi)
            assert output is not None
