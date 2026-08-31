"""
engine/tests/test_cold_start.py

Tests for cold-start behaviour.

Cold-start = has_declared_profile=False, personas=["default_general"].
The homepage must still render a sensible, non-empty set of cards
with zero configuration from the user.

Source: 03_personalization_logic_and_decision_matrix.md §11,
        10_testing_and_validation_plan.md §1 (cold-start test).
"""
import pytest

from engine.engine import rank


class TestColdStart:
    def test_cold_start_produces_non_empty_output(self, cf_cold_start):
        """Cold-start must never produce an empty ranked_cards array."""
        output = rank(cf_cold_start)
        total = len(output.ranked_cards) + len(output.override_warnings)
        assert total > 0, "Cold-start homepage must not be empty."

    def test_cold_start_pollen_absent(self, cf_cold_start):
        """Pollen must never appear in cold-start output (no opt-in)."""
        output = rank(cf_cold_start)
        all_cards = output.ranked_cards + output.override_warnings
        ids = [c.card_id for c in all_cards]
        assert "pollen_illustrative" not in ids

    def test_cold_start_severe_warning_absent_when_no_warnings(self, cf_cold_start):
        output = rank(cf_cold_start)
        assert output.override_warnings == []

    def test_cold_start_general_conditions_present(self, cf_cold_start):
        """General conditions is the universal fallback card; always visible cold-start."""
        output = rank(cf_cold_start)
        ids = [c.card_id for c in output.ranked_cards]
        assert "general_conditions" in ids

    def test_cold_start_has_declared_profile_false(self, cf_cold_start):
        assert cf_cold_start.has_declared_profile is False

    def test_cold_start_no_persona_clause_in_explanation(self, cf_cold_start):
        """Cold-start explanations must not falsely claim 'your declared persona'."""
        output = rank(cf_cold_start)
        for card in output.ranked_cards:
            assert "declared persona" not in card.explanation_text, (
                f"Card {card.card_id!r} falsely claimed declared persona for cold-start user."
            )

    def test_cold_start_general_conditions_ranks_in_top_3(self, cf_cold_start):
        """
        Per 03_...md §11: general_conditions should rank near top for default_general.
        P0 override exists in override_warnings only, so we check ranked_cards.
        """
        output = rank(cf_cold_start)
        ids = [c.card_id for c in output.ranked_cards]
        assert "general_conditions" in ids
        pos = ids.index("general_conditions")
        assert pos <= 3, (
            f"general_conditions ranked at position {pos}, expected within top 3."
        )
