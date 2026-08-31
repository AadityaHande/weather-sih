"""
engine/tests/test_missing_data.py

Tests for missing/stale/degraded data handling.

The engine must:
- Never crash when a signal is unavailable.
- Never fabricate values for unavailable signals.
- Down-weight stale data naturally through confidence_factor.
- Preserve signal provenance (source tag) throughout.

Source: 03_personalization_logic_and_decision_matrix.md §10,
        07_api_and_data_contracts.md §4–§5,
        10_testing_and_validation_plan.md §1.
"""
import pytest

from engine.engine import rank


class TestMissingData:
    def test_no_crash_on_missing_aqi(self, cf_aqi_missing):
        """Engine must not raise when AQI is unavailable."""
        output = rank(cf_aqi_missing)   # Must not raise

    def test_aqi_card_absent_when_unavailable(self, cf_aqi_missing):
        """
        aqi_health card must be omitted when AQI is unavailable —
        there is no safe default value for AQI.
        Source: 03_...md §10(a).
        """
        output = rank(cf_aqi_missing)
        ids = [c.card_id for c in output.ranked_cards]
        assert "aqi_health" not in ids

    def test_output_still_non_empty_with_missing_aqi(self, cf_aqi_missing):
        """Other cards must still render even if AQI is missing."""
        output = rank(cf_aqi_missing)
        assert len(output.ranked_cards) > 0

    def test_no_crash_on_all_signals_unavailable(self, cf_all_unavailable):
        """Even with all environmental signals unavailable, must not crash."""
        output = rank(cf_all_unavailable)   # Must not raise

    def test_no_fabricated_value_when_unavailable(self, cf_all_unavailable):
        """
        07_...md §5 invariant: no value_summary from 'unavailable' signal
        may look like a live number without disclosure.
        We check signal_refs: no 'unavailable' signal should have a real numeric value.
        """
        output = rank(cf_all_unavailable)
        for card in output.ranked_cards + output.override_warnings:
            for ref in card.signal_refs:
                if ref["source"] == "unavailable":
                    assert ref["value"] is None, (
                        f"Card {card.card_id!r} signal {ref['signal']!r} is 'unavailable' "
                        f"but carries value {ref['value']!r} — this looks fabricated."
                    )

    def test_sunrise_sunset_always_present(self, cf_all_unavailable):
        """
        Sunrise/sunset is locally computed and must always be present
        even when all other signals are unavailable (08_...md §2).
        """
        output = rank(cf_all_unavailable)
        ids = [c.card_id for c in output.ranked_cards]
        assert "sunrise_sunset" in ids


class TestStaleData:
    def test_stale_aqi_card_present_but_lower_score(self, cf_health_high_aqi, cf_stale_aqi):
        """
        Stale AQI should still show the card (cached value = safe default),
        but score should be lower than live data with same values.
        """
        out_live  = rank(cf_health_high_aqi)
        out_stale = rank(cf_stale_aqi)

        aqi_live_card  = next((c for c in out_live.ranked_cards  if c.card_id == "aqi_health"), None)
        aqi_stale_card = next((c for c in out_stale.ranked_cards if c.card_id == "aqi_health"), None)

        # Stale card must still appear (we have a cached value)
        assert aqi_stale_card is not None, "aqi_health should still appear for stale data."

        # Score must be lower for stale data (confidence_factor 0.3 vs 1.0)
        if aqi_live_card:
            assert aqi_stale_card.score < aqi_live_card.score

    def test_stale_data_source_preserved_in_signal_refs(self, cf_stale_aqi):
        """The 'stale' source tag must be visible in signal_refs."""
        output = rank(cf_stale_aqi)
        aqi_card = next((c for c in output.ranked_cards if c.card_id == "aqi_health"), None)
        if aqi_card:
            aqi_ref = next((r for r in aqi_card.signal_refs if r["signal"] == "aqi"), None)
            assert aqi_ref is not None
            assert aqi_ref["source"] == "stale"


class TestPollenGating:
    def test_pollen_appears_with_opt_in(self, cf_pollen_opt_in):
        """Pollen card must appear when health persona + pollen_interest flag."""
        output = rank(cf_pollen_opt_in)
        ids = [c.card_id for c in output.ranked_cards]
        assert "pollen_illustrative" in ids

    def test_pollen_absent_without_flag(self, cf_pollen_no_flag):
        """Pollen card must NOT appear without the pollen_interest health flag."""
        output = rank(cf_pollen_no_flag)
        ids = [c.card_id for c in output.ranked_cards]
        assert "pollen_illustrative" not in ids

    def test_pollen_absent_for_fitness_persona(self, cf_fitness_high_uv):
        """Fitness persona must never see pollen even with pollen data available."""
        output = rank(cf_fitness_high_uv)
        ids = [c.card_id for c in output.ranked_cards]
        assert "pollen_illustrative" not in ids

    def test_pollen_source_is_simulated(self, cf_pollen_opt_in):
        """Pollen source must always be disclosed as 'simulated'."""
        output = rank(cf_pollen_opt_in)
        pollen_card = next((c for c in output.ranked_cards if c.card_id == "pollen_illustrative"), None)
        if pollen_card:
            pollen_ref = next(r for r in pollen_card.signal_refs if r["signal"] == "pollen")
            assert pollen_ref["source"] == "simulated"

    def test_pollen_is_never_alert(self, cf_pollen_opt_in):
        output = rank(cf_pollen_opt_in)
        pollen_card = next((c for c in output.ranked_cards if c.card_id == "pollen_illustrative"), None)
        if pollen_card:
            assert pollen_card.is_alert is False
