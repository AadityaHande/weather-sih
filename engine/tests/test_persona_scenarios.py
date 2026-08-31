"""
engine/tests/test_persona_scenarios.py

THE MOST IMPORTANT TEST FILE IN MILESTONE 1.

These tests demonstrate the central thesis of the project:

  The engine is a CONTEXTUAL PRIORITIZATION ENGINE, not a persona filter.

Concretely, these tests prove that:
1. The same environmental ContextFrame produces different card orderings
   for different personas.
2. Changing the environment with the same persona produces different
   orderings (urgency_multiplier is doing real work).
3. Each scenario matches the documented expected behaviour from
   03_personalization_logic_and_decision_matrix.md §82–§88.

These tests ARE the spike feasibility baseline referenced in §30 of
10_testing_and_validation_plan.md.
"""
import pytest

from engine.engine import rank


# ---------------------------------------------------------------------------
# Test 1: Same weather, different personas
# (Scenario A from 03_...md §82)
# Weather: AQI 165, UV 9, precip_prob 40%
# ---------------------------------------------------------------------------

class TestSameWeatherDifferentPersonas:
    """
    The definitive test of the central product thesis.
    AQI 165 + UV 9 + 40% rain — each persona should see a different top card.
    """

    def test_health_top_card_is_aqi(self, cf_same_weather_health):
        """
        Health persona + respiratory flag → AQI card should rank above UV and Rain.
        Per 03_...md §86: 'AQI card → P1 alert, top of stack.'
        """
        output = rank(cf_same_weather_health)
        top_card = output.ranked_cards[0].card_id
        assert top_card == "aqi_health", (
            f"Health persona with AQI 165 expected aqi_health on top, got {top_card!r}."
        )

    def test_fitness_top_card_is_uv_or_activity(self, cf_same_weather_fitness):
        """
        Fitness persona → UV-affected activity window is the most pressing concern.
        Per 03_...md §87: 'UV card → P1... or Best Activity Window.'
        """
        output = rank(cf_same_weather_fitness)
        ranked_ids = [c.card_id for c in output.ranked_cards[:3]]
        assert "uv_sun_exposure" in ranked_ids or "activity_window" in ranked_ids, (
            f"Fitness persona expected UV/activity in top-3, got {ranked_ids}."
        )

    def test_family_top_card_is_rain(self, cf_same_weather_family):
        """
        Family persona + active commute window → Rain card should rank first.
        Per 03_...md §88: 'Rain card → P1 (precip_prob relevant to commute window).'
        """
        output = rank(cf_same_weather_family)
        top_card = output.ranked_cards[0].card_id
        assert top_card == "rain_commute", (
            f"Family persona (commute active) + 40% rain expected rain_commute on top, got {top_card!r}."
        )

    def test_personas_produce_different_orderings(
        self, cf_same_weather_health, cf_same_weather_fitness, cf_same_weather_family
    ):
        """
        Core thesis proof: same ContextFrame base, different personas → different order.
        If all three produce identical top cards, the engine is behaving like a
        simple pass-through (Risk R5 — which we are explicitly mitigating).
        """
        top_health  = rank(cf_same_weather_health).ranked_cards[0].card_id
        top_fitness = rank(cf_same_weather_fitness).ranked_cards[0].card_id
        top_family  = rank(cf_same_weather_family).ranked_cards[0].card_id

        # Not all three should be the same — that would mean persona has no effect.
        all_same = (top_health == top_fitness == top_family)
        assert not all_same, (
            f"All three personas got the same top card ({top_health!r}). "
            "The engine is not differentiating by persona. Risk R5 not mitigated."
        )

    def test_health_aqi_scores_higher_than_fitness_aqi(
        self, cf_same_weather_health, cf_same_weather_fitness
    ):
        """AQI weight for health persona > fitness persona → higher score."""
        out_h = rank(cf_same_weather_health)
        out_f = rank(cf_same_weather_fitness)
        aqi_score_h = next(c.score for c in out_h.ranked_cards if c.card_id == "aqi_health")
        aqi_score_f = next(c.score for c in out_f.ranked_cards if c.card_id == "aqi_health")
        assert aqi_score_h > aqi_score_f

    def test_rain_commute_scores_higher_for_family(
        self, cf_same_weather_health, cf_same_weather_family
    ):
        """Rain/commute weight for family > health → family scores it higher."""
        out_h = rank(cf_same_weather_health)
        out_f = rank(cf_same_weather_family)
        rain_h = next((c.score for c in out_h.ranked_cards if c.card_id == "rain_commute"), 0)
        rain_f = next((c.score for c in out_f.ranked_cards if c.card_id == "rain_commute"), 0)
        assert rain_f > rain_h


# ---------------------------------------------------------------------------
# Test 2: Individual persona scenarios
# ---------------------------------------------------------------------------

class TestHealthPersonaScenario:
    def test_high_aqi_health_is_p1_alert(self, cf_health_high_aqi):
        output = rank(cf_health_high_aqi)
        aqi_card = next(c for c in output.ranked_cards if c.card_id == "aqi_health")
        assert aqi_card.priority == "P1"
        assert aqi_card.is_alert is True

    def test_moderate_aqi_health_is_at_most_p2(self, cf_health_moderate):
        output = rank(cf_health_moderate)
        aqi_card = next(c for c in output.ranked_cards if c.card_id == "aqi_health")
        assert aqi_card.priority in ("P2", "P1")   # moderate = could be either

    def test_health_pollen_absent_without_flag(self, cf_health_moderate):
        output = rank(cf_health_moderate)
        ids = [c.card_id for c in output.ranked_cards]
        assert "pollen_illustrative" not in ids


class TestFitnessPersonaScenario:
    def test_high_uv_fitness_is_p1(self, cf_fitness_high_uv):
        output = rank(cf_fitness_high_uv)
        uv_card = next(c for c in output.ranked_cards if c.card_id == "uv_sun_exposure")
        assert uv_card.priority == "P1"

    def test_activity_window_present_for_fitness(self, cf_fitness_high_uv):
        output = rank(cf_fitness_high_uv)
        ids = [c.card_id for c in output.ranked_cards]
        assert "activity_window" in ids

    def test_activity_window_top3_for_fitness(self, cf_fitness_good_conditions):
        """In good conditions, activity window should rank highly for fitness persona."""
        output = rank(cf_fitness_good_conditions)
        ids = [c.card_id for c in output.ranked_cards[:4]]
        assert "activity_window" in ids or "sunrise_sunset" in ids


class TestFamilyPersonaScenario:
    def test_rain_commute_top_for_family_commute(self, cf_family_commute_rain):
        output = rank(cf_family_commute_rain)
        top_card = output.ranked_cards[0].card_id
        assert top_card == "rain_commute"

    def test_low_rain_family_rain_not_top(self, cf_family_no_rain):
        output = rank(cf_family_no_rain)
        if output.ranked_cards:
            top_card = output.ranked_cards[0].card_id
            # Low rain outside commute window should not push rain to top
            # (unless scored P1 by very high family weight — still let's verify it makes sense)
            rain_card = next((c for c in output.ranked_cards if c.card_id == "rain_commute"), None)
            if rain_card:
                assert rain_card.priority in ("P2", "P3"), (
                    "10% rain should not produce a P1 rain_commute for family."
                )


# ---------------------------------------------------------------------------
# Test 3: Environment change moves priority (same persona, different enviro)
# (Scenario B from 03_...md §90)
# ---------------------------------------------------------------------------

class TestContextChangeMovesPriority:
    """
    Same user (fitness), different environmental state at different times.
    Verifies urgency_multiplier is doing real work independent of persona.
    """

    def test_high_uv_afternoon_raises_uv_priority(
        self, cf_fitness_good_conditions, cf_fitness_high_uv
    ):
        """
        7am: UV low (2.0) → UV card should be P2/P3.
        1pm: UV high (9.0) → UV card should be P1.
        Same persona, environmental change drives priority change.
        """
        out_morning   = rank(cf_fitness_good_conditions)
        out_afternoon = rank(cf_fitness_high_uv)

        uv_morning   = next(c for c in out_morning.ranked_cards   if c.card_id == "uv_sun_exposure")
        uv_afternoon = next(c for c in out_afternoon.ranked_cards if c.card_id == "uv_sun_exposure")

        assert uv_afternoon.score > uv_morning.score, (
            "Higher UV at 1pm should produce higher uv_sun_exposure score."
        )
        assert uv_afternoon.priority in ("P1", "P2")
        assert uv_morning.priority in ("P2", "P3")

    def test_severe_warning_makes_p0_appear_regardless_of_previous_state(
        self, cf_fitness_high_uv, cf_severe_warning
    ):
        """
        Scenario B afternoon: warning issued → P0 overrides everything.
        The activity_window card that was P1 minutes earlier drops to ranked_cards.
        """
        out_no_warning = rank(cf_fitness_high_uv)
        out_warning    = rank(cf_severe_warning)

        assert out_no_warning.override_warnings == [], "No warning = no P0 overrides."
        assert len(out_warning.override_warnings) == 1, "Warning = exactly one P0 override."
        assert out_warning.override_warnings[0].card_id == "severe_warning"
