"""
engine/tests/test_remediation.py

Focused regression tests for Milestone 1 Audit findings F-01 through F-05.

Each test is labeled with the audit finding it covers, with an assertion
that proves the specific invariant either was broken (before remediation)
or remains correctly satisfied (after remediation).

Audit findings:
  F-01 — Scoring math contradiction (simulated rain for Family → P1)
  F-02 — Alert visibility floor (alerts never ranked P3)
  F-03 — Boundary checker self-test
  F-05 — Validation gaps (lat/lon range, confidence range, cold-start determinism)

Source docs (read-only, not modified):
  03_personalization_logic_and_decision_matrix.md §4, §5, §6, §88
  13_final_mvp_specification.md (IMD rain = simulated)
  15_implementation_completion_and_handoff.md §1
  docs/IMPL_CALIBRATION_DECISIONS.md (CAL-01, CAL-02)
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
import pytest

from engine.models import ContextFrame, SignalValue, validate_context_frame
from engine.priority import (
    P1_THRESHOLD,
    P2_THRESHOLD,
    apply_alert_priority_floor,
    classify_priority,
    is_alert,
)
from engine.scoring import CONFIDENCE_BY_SOURCE, urgency_multiplier, confidence_factor, score
from engine.engine import rank

# Repo root: engine/tests/test_remediation.py → ../../../ gives project root
REPO_ROOT = Path(__file__).parent.parent.parent


# ---------------------------------------------------------------------------
# Local helpers — keeps tests self-contained without relying on conftest
# ---------------------------------------------------------------------------

def _sv(value, source: str) -> SignalValue:
    """Build a SignalValue for testing."""
    conf = CONFIDENCE_BY_SOURCE.get(source, 0.0)
    return SignalValue(value=value, source=source, freshness_min=0, confidence=conf)  # type: ignore[arg-type]


def _make_cf(**kwargs) -> ContextFrame:
    """
    Build a minimal valid ContextFrame. All environmental signals default to
    live values suitable for a stable baseline. Override with kwargs.
    """
    defaults = dict(
        personas=["family"],
        health_flags=[],
        has_declared_profile=True,
        local_time="2026-08-26T08:30:00+05:30",
        is_commute_window=True,
        is_daylight=True,
        lat=18.5204,
        lon=73.8567,
        location_name="Pune",
        temp_c=_sv(28.0, "live"),
        feels_like_c=_sv(30.0, "live"),
        humidity_pct=_sv(65, "live"),
        wind_kmh=_sv(14.0, "live"),
        precip_prob_pct=_sv(60, "simulated"),
        warnings=[],
        aqi=SignalValue(
            value={"aqi": 165, "dominant": "pm2.5"},
            source="live",
            freshness_min=10,
            confidence=1.0,
        ),
        uv=_sv(9.0, "live"),
        pollen=None,
        sunrise="06:10",
        sunset="18:55",
    )
    defaults.update(kwargs)
    return ContextFrame(**defaults)


# ---------------------------------------------------------------------------
# F-01 — Scoring math: simulated rain for Family → P1 (CAL-01)
# ---------------------------------------------------------------------------

class TestF01ScenarioAMath:
    """
    Audit F-01: 03_...md §88 requires Family + commute + rain → P1.
    With simulated data (confidence=0.7) and the ORIGINAL urgency=2.0:
        0.95 × 2.0 × 0.7 = 1.33  <  1.5  ← was P2, violated §88.

    After calibration (urgency=2.35):
        0.95 × 2.35 × 0.7 = 1.56275  ≥  1.5  → P1  ✅

    Source: docs/IMPL_CALIBRATION_DECISIONS.md CAL-01.
    """

    def test_f01_urgency_multiplier_for_commute_plus_high_precip(self):
        """
        The calibrated urgency for commute + ≥60% precip must be 2.35.
        This is the constant changed from 2.0 to resolve F-01.
        """
        cf = _make_cf(is_commute_window=True, precip_prob_pct=_sv(60, "simulated"))
        um = urgency_multiplier("rain_commute", cf)
        assert um == pytest.approx(2.35), (
            f"Expected urgency_multiplier = 2.35 for commute + 60% precip, got {um}. "
            "Check scoring.py rain_commute branch — CAL-01 calibration may have been reverted."
        )

    def test_f01_scenario_a_family_simulated60_score_math_explicit(self):
        """
        Explicit assertion of all three score components and the final score.
        The raw math must be 0.95 × 2.35 × 0.7 = 1.56275.
        """
        cf = _make_cf(is_commute_window=True, precip_prob_pct=_sv(60, "simulated"))
        primary = _sv(60, "simulated")
        raw_score, components = score("rain_commute", "family", cf, primary)

        assert components["persona_weight"] == pytest.approx(0.95), (
            "PERSONA_WEIGHT[rain_commute/family] must remain 0.95 (unchanged per F-01 plan)."
        )
        assert components["urgency_multiplier"] == pytest.approx(2.35), (
            "Urgency for commute + ≥60% precip must be 2.35 (see CAL-01)."
        )
        assert components["confidence_factor"] == pytest.approx(0.7), (
            "Simulated confidence must be 0.7 (unchanged per F-01 plan — 03_...md §4)."
        )
        expected = 0.95 * 2.35 * 0.7  # = 1.56275
        assert raw_score == pytest.approx(expected, rel=1e-4), (
            f"Raw score = {raw_score}, expected {expected:.5f} (0.95 × 2.35 × 0.7)."
        )
        assert raw_score >= P1_THRESHOLD, (
            f"Score {raw_score:.5f} must be ≥ P1_THRESHOLD ({P1_THRESHOLD}) for Family simulated(60)."
        )

    def test_f01_scenario_a_family_simulated60_commute_reaches_p1(self):
        """
        End-to-end: Family + simulated(60) + commute window → rain_commute card is P1.
        This is the core regression for 03_...md §88 Scenario A.
        """
        cf = _make_cf(is_commute_window=True, precip_prob_pct=_sv(60, "simulated"))
        output = rank(cf)
        all_cards = output.ranked_cards + output.override_warnings
        rain_card = next((c for c in all_cards if c.card_id == "rain_commute"), None)

        assert rain_card is not None, "rain_commute card must be present in output"
        assert rain_card.priority == "P1", (
            f"rain_commute must be P1 for Family + simulated(60) + commute. "
            f"Got {rain_card.priority}. Score={rain_card.score}, components={rain_card.score_components}. "
            "Check if F-01 calibration (urgency 2.35) has been reverted."
        )

    def test_f01_scenario_a_family_simulated40_commute_stays_p2(self):
        """
        Boundary test: Family + simulated(40) + commute triggers the 30≤p<60 band
        (urgency=1.5), giving score = 0.95 × 1.5 × 0.7 = 0.9975 → P2 (not P1).

        This proves the P1 result is legitimately gated on ≥60% precip,
        not accidentally granted to all commute-window rain scenarios.
        """
        cf = _make_cf(is_commute_window=True, precip_prob_pct=_sv(40, "simulated"))
        primary = _sv(40, "simulated")
        raw_score, components = score("rain_commute", "family", cf, primary)

        expected = 0.95 * 1.5 * 0.7  # = 0.9975
        assert raw_score == pytest.approx(expected, rel=1e-4), (
            f"simulated(40) commute score should be {expected:.4f}, got {raw_score}."
        )
        assert raw_score < P1_THRESHOLD, (
            f"simulated(40) commute score {raw_score} must be below P1 threshold ({P1_THRESHOLD})."
        )
        assert raw_score >= P2_THRESHOLD, (
            f"simulated(40) commute score {raw_score} should be ≥ P2 threshold ({P2_THRESHOLD})."
        )

        priority = classify_priority("rain_commute", raw_score, cf)
        assert priority == "P2", (
            f"Family + simulated(40) + commute must reach P2, not P1 or P3. Got {priority}."
        )

    def test_f01_no_commute_rain_never_p1_with_simulated(self):
        """
        Without commute window, even 60% simulated rain should not reach P1.
        Score = 0.95 × 1.3 × 0.7 = 0.8645 → P2.
        """
        cf = _make_cf(is_commute_window=False, precip_prob_pct=_sv(60, "simulated"))
        primary = _sv(60, "simulated")
        raw_score, components = score("rain_commute", "family", cf, primary)

        assert components["urgency_multiplier"] == pytest.approx(1.3), (
            "Without commute window, 60% rain → urgency should be 1.3 (non-commute band)."
        )
        expected = 0.95 * 1.3 * 0.7
        assert raw_score == pytest.approx(expected, rel=1e-4)
        assert raw_score < P1_THRESHOLD, (
            f"No-commute simulated(60) score {raw_score:.4f} must not reach P1."
        )


# ---------------------------------------------------------------------------
# F-02 — Alert priority floor: is_alert=True cards never get priority P3
# ---------------------------------------------------------------------------

class TestF02AlertPriorityFloor:
    """
    Audit F-02: 03_...md §6 states alerts are 'never hidden'.
    §5 states P3 cards are 'shown lower on the page or collapsed'.
    A card cannot be simultaneously is_alert=True and priority=P3.

    apply_alert_priority_floor() must:
    - raise P3 → P2 for alert cards
    - NOT raise P2 → P1
    - NOT change non-alert P3 cards
    - NEVER modify the underlying score
    """

    def test_f02_floor_raises_p3_alert_to_p2(self):
        """Direct unit test of apply_alert_priority_floor — P3 alert → P2."""
        assert apply_alert_priority_floor("P3", True) == "P2"

    def test_f02_floor_does_not_raise_p2_alert_to_p1(self):
        """P2 alert stays P2 — floor only applies at the P3 boundary."""
        assert apply_alert_priority_floor("P2", True) == "P2"

    def test_f02_floor_does_not_affect_non_alert_p3(self):
        """Non-alert P3 cards remain P3."""
        assert apply_alert_priority_floor("P3", False) == "P3"

    def test_f02_floor_does_not_affect_p0(self):
        """P0 cards are unaffected by the floor."""
        assert apply_alert_priority_floor("P0", True) == "P0"

    def test_f02_stale_aqi_alert_has_p2_floor_not_p3(self):
        """
        Stale AQI (confidence=0.3) at AQI=160 (Poor band, urgency=1.8):
            score = 0.9 × 1.8 × 0.3 = 0.486 < P2_THRESHOLD → raw P3
            but is_alert=True (urgency=1.8 ≥ alert threshold 1.8)
            → floor elevates to P2

        This is the exact scenario 03_...md §6 prohibits hiding.
        """
        stale_aqi = SignalValue(
            value={"aqi": 160, "dominant": "pm2.5"},
            source="stale",
            freshness_min=360,
            confidence=0.3,
        )
        cf = _make_cf(
            personas=["health"],
            health_flags=["respiratory_sensitive"],
            is_commute_window=False,
            aqi=stale_aqi,
        )
        output = rank(cf)
        all_cards = output.ranked_cards + output.override_warnings
        aqi_card = next((c for c in all_cards if c.card_id == "aqi_health"), None)

        assert aqi_card is not None, "aqi_health card must be present"

        # Raw score verification — score itself must be the stale-penalised value
        expected_raw = 0.9 * 1.8 * 0.3  # = 0.486
        assert aqi_card.score == pytest.approx(expected_raw, rel=1e-3), (
            f"Raw score must be the unadjusted formula value {expected_raw:.4f}. "
            f"Got {aqi_card.score}. The floor must NOT mutate the score."
        )

        # Alert status
        assert aqi_card.is_alert is True, (
            "AQI 160 (Poor, urgency=1.8) must be is_alert=True."
        )

        # Priority floor applied — never P3 for an alert
        assert aqi_card.priority in ("P0", "P1", "P2"), (
            f"Alert card must not be P3. Got priority={aqi_card.priority}, "
            f"score={aqi_card.score}. "
            "apply_alert_priority_floor() may not be wired into engine.py correctly. "
            "See CAL-02 in docs/IMPL_CALIBRATION_DECISIONS.md."
        )
        assert aqi_card.priority == "P2", (
            f"Stale alert score {aqi_card.score:.4f} < P2_THRESHOLD — expected P2 floor. "
            f"Got {aqi_card.priority}."
        )

    def test_f02_stale_alert_score_is_raw_not_floored(self):
        """
        The score stored in RankedCard.score must be the raw formula product,
        not the floored value. Only the priority tier is adjusted.
        """
        stale_aqi = SignalValue(
            value={"aqi": 160, "dominant": "pm2.5"},
            source="stale",
            freshness_min=360,
            confidence=0.3,
        )
        cf = _make_cf(
            personas=["health"],
            health_flags=[],
            is_commute_window=False,
            aqi=stale_aqi,
        )
        output = rank(cf)
        all_cards = output.ranked_cards + output.override_warnings
        aqi_card = next((c for c in all_cards if c.card_id == "aqi_health"), None)

        assert aqi_card is not None
        raw_formula = (
            aqi_card.score_components["persona_weight"]
            * aqi_card.score_components["urgency_multiplier"]
            * aqi_card.score_components["confidence_factor"]
        )
        assert aqi_card.score == pytest.approx(raw_formula, rel=1e-4), (
            f"RankedCard.score ({aqi_card.score}) must equal pw×um×cf "
            f"({raw_formula:.5f}). The floor must not alter the score."
        )

    def test_f02_non_alert_p3_stays_p3(self):
        """
        A low-urgency, low-weight card that is not is_alert must remain P3.
        sunrise_sunset for default_general at baseline = 0.3 × 1.0 × 1.0 = 0.3 < P2_THRESHOLD.
        """
        cf = _make_cf(
            personas=["default_general"],
            has_declared_profile=False,
            is_commute_window=False,
            aqi=_sv(50, "live"),  # baseline AQI — low urgency
            uv=_sv(3.0, "live"),  # low UV
            precip_prob_pct=_sv(5, "live"),
        )
        output = rank(cf)
        all_cards = output.ranked_cards + output.override_warnings
        sunrise_card = next((c for c in all_cards if c.card_id == "sunrise_sunset"), None)

        if sunrise_card is not None:  # sunrise_sunset always applies
            assert sunrise_card.is_alert is False, (
                "sunrise_sunset should never be an alert in baseline conditions."
            )
            # If score < P2_THRESHOLD, it should stay P3 (no floor for non-alerts)
            if sunrise_card.score < P2_THRESHOLD:
                assert sunrise_card.priority == "P3", (
                    f"Non-alert P3 card must remain P3. Got {sunrise_card.priority}. "
                    "The floor must not be applied to non-alert cards."
                )


# ---------------------------------------------------------------------------
# F-03 — Boundary checker self-test (via subprocess)
# ---------------------------------------------------------------------------

class TestF03BoundaryChecker:
    """
    Audit F-03: The AST-based boundary checker must detect forbidden imports.
    Run via subprocess to prove the checker is executable as a standalone script.
    """

    def test_f03_boundary_self_test_passes(self):
        """
        Run 'python check_boundaries.py --self-test' from the repo root.
        Expect exit code 0 (checker itself passes + self-test confirms detection works).
        """
        result = subprocess.run(
            [sys.executable, "check_boundaries.py", "--self-test"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
        combined = result.stdout + result.stderr
        assert result.returncode == 0, (
            f"check_boundaries.py --self-test exited with code {result.returncode}.\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
        assert "Self-test PASSED" in combined, (
            f"Expected 'Self-test PASSED' in output. Got:\n{combined}"
        )
        assert "Boundary check passed" in combined, (
            f"Expected 'Boundary check passed' in output. Got:\n{combined}"
        )

    def test_f03_boundary_check_main_passes_engine(self):
        """
        Run 'python check_boundaries.py' (no self-test).
        The actual engine/ directory must pass with 0 violations.
        """
        result = subprocess.run(
            [sys.executable, "check_boundaries.py"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, (
            f"Boundary check failed with code {result.returncode}.\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
        assert "passed" in result.stdout.lower(), (
            f"Expected 'passed' in boundary check output. Got:\n{result.stdout}"
        )


# ---------------------------------------------------------------------------
# F-05 — Coordinate validation
# ---------------------------------------------------------------------------

class TestF05CoordinateValidation:
    """
    03_...md §2 and 07_...md define lat/lon as ContextFrame fields.
    validate_context_frame() must reject mathematically invalid ranges.

    Note: Only standard geodetic ranges [-90,90] / [-180,180] are validated.
    No India bounding box is enforced — the product supports saved destinations
    globally (travelers, etc.).
    """

    def test_f05_valid_latitude_pune(self):
        cf = _make_cf(lat=18.5204, lon=73.8567)
        errors = validate_context_frame(cf)
        assert "lat" not in str(errors)

    def test_f05_valid_latitude_london(self):
        """International coordinate — must be valid (no India restriction)."""
        cf = _make_cf(lat=51.5074, lon=-0.1278)
        errors = validate_context_frame(cf)
        assert not any("lat" in e or "lon" in e for e in errors), (
            f"London coordinates should be valid. Got errors: {errors}. "
            "Do not add India-only bounding box restriction."
        )

    def test_f05_invalid_latitude_too_high(self):
        cf = _make_cf(lat=91.0, lon=73.8567)
        errors = validate_context_frame(cf)
        assert any("lat" in e for e in errors), (
            f"lat=91.0 should be rejected. Got errors: {errors}"
        )

    def test_f05_invalid_latitude_too_low(self):
        cf = _make_cf(lat=-91.0, lon=73.8567)
        errors = validate_context_frame(cf)
        assert any("lat" in e for e in errors), (
            f"lat=-91.0 should be rejected. Got errors: {errors}"
        )

    def test_f05_invalid_longitude_too_high(self):
        cf = _make_cf(lat=18.52, lon=181.0)
        errors = validate_context_frame(cf)
        assert any("lon" in e for e in errors), (
            f"lon=181.0 should be rejected. Got errors: {errors}"
        )

    def test_f05_invalid_longitude_too_low(self):
        cf = _make_cf(lat=18.52, lon=-181.0)
        errors = validate_context_frame(cf)
        assert any("lon" in e for e in errors), (
            f"lon=-181.0 should be rejected. Got errors: {errors}"
        )

    def test_f05_boundary_lat_90_is_valid(self):
        """Exact boundary: lat=90 is the North Pole — valid per IEEE convention."""
        cf = _make_cf(lat=90.0, lon=0.0)
        errors = validate_context_frame(cf)
        assert not any("lat" in e for e in errors)

    def test_f05_boundary_lat_minus90_is_valid(self):
        cf = _make_cf(lat=-90.0, lon=0.0)
        errors = validate_context_frame(cf)
        assert not any("lat" in e for e in errors)

    def test_f05_empty_personas_rejected(self):
        """personas=[] must be rejected — validate_context_frame must catch it."""
        cf = _make_cf(personas=[])
        errors = validate_context_frame(cf)
        assert any("persona" in e.lower() for e in errors), (
            f"Empty personas must produce a validation error. Got: {errors}"
        )


# ---------------------------------------------------------------------------
# F-05 — Confidence / provenance validation
# ---------------------------------------------------------------------------

class TestF05Provenance:
    """
    validate_context_frame() validates that confidence values are in [0, 1].
    This checks both underflow and overflow cases.
    """

    def test_f05_confidence_out_of_range_high(self):
        """confidence=1.5 for AQI should be rejected."""
        cf = _make_cf(
            aqi=SignalValue(
                value={"aqi": 50, "dominant": "pm2.5"},
                source="live",
                freshness_min=5,
                confidence=1.5,  # invalid
            )
        )
        errors = validate_context_frame(cf)
        assert any("aqi" in e and "confidence" in e for e in errors), (
            f"confidence=1.5 should produce validation error. Got: {errors}"
        )

    def test_f05_confidence_out_of_range_negative(self):
        """confidence=-0.1 for UV should be rejected."""
        cf = _make_cf(
            uv=SignalValue(
                value=8.0,
                source="live",
                freshness_min=5,
                confidence=-0.1,  # invalid
            )
        )
        errors = validate_context_frame(cf)
        assert any("uv" in e and "confidence" in e for e in errors), (
            f"confidence=-0.1 should produce validation error. Got: {errors}"
        )

    def test_f05_confidence_zero_is_valid(self):
        """confidence=0.0 is valid — this is the 'unavailable' case."""
        cf = _make_cf(
            aqi=SignalValue(
                value=None,
                source="unavailable",
                freshness_min=None,
                confidence=0.0,
            )
        )
        errors = validate_context_frame(cf)
        assert not any("aqi" in e and "confidence" in e for e in errors)

    def test_f05_confidence_one_is_valid(self):
        """confidence=1.0 is the upper bound — valid."""
        cf = _make_cf(
            aqi=SignalValue(
                value={"aqi": 80, "dominant": "pm2.5"},
                source="live",
                freshness_min=5,
                confidence=1.0,
            )
        )
        errors = validate_context_frame(cf)
        assert not any("aqi" in e and "confidence" in e for e in errors)


# ---------------------------------------------------------------------------
# F-05 — Cold-start determinism
# ---------------------------------------------------------------------------

class TestF05Determinism:
    """
    10_...md §1: 'Given a fixed ContextFrame, output ranking is deterministic
    (same input → same output, run twice).'
    Run rank() multiple times on identical input and assert identical output.
    """

    def test_f05_cold_start_determinism_across_10_runs(self):
        """Cold-start rank() output must be identical across 10 runs."""
        cf = _make_cf(
            personas=["default_general"],
            has_declared_profile=False,
            is_commute_window=False,
            aqi=SignalValue(
                value={"aqi": 80, "dominant": "pm2.5"},
                source="live",
                freshness_min=5,
                confidence=1.0,
            ),
            uv=_sv(5.0, "live"),
            precip_prob_pct=_sv(20, "simulated"),
        )
        outputs = [rank(cf) for _ in range(10)]
        first_ids = [c.card_id for c in outputs[0].ranked_cards]
        for i, out in enumerate(outputs[1:], start=2):
            ids = [c.card_id for c in out.ranked_cards]
            assert ids == first_ids, (
                f"Run {i} produced different card order than run 1. "
                f"Run 1: {first_ids}. Run {i}: {ids}. "
                "rank() must be deterministic for identical ContextFrame input."
            )

    def test_f05_determinism_with_declared_profile(self):
        """Determinism also holds for declared-profile (non-cold-start) sessions."""
        cf = _make_cf(
            personas=["health"],
            health_flags=["respiratory_sensitive"],
            is_commute_window=False,
            aqi=SignalValue(
                value={"aqi": 175, "dominant": "pm2.5"},
                source="live",
                freshness_min=5,
                confidence=1.0,
            ),
            uv=_sv(9.0, "live"),
        )
        outputs = [rank(cf) for _ in range(5)]
        first_ids = [c.card_id for c in outputs[0].ranked_cards]
        for i, out in enumerate(outputs[1:], start=2):
            ids = [c.card_id for c in out.ranked_cards]
            assert ids == first_ids, (
                f"Non-cold-start: run {i} differs from run 1. "
                f"Run 1: {first_ids}. Run {i}: {ids}."
            )

    def test_f05_tie_break_is_stable(self):
        """
        Two cards with identical scores must always resolve in the same stable order.
        Use sunrise_sunset vs general_conditions at baseline (both score 0.3×1.0×1.0=0.3).
        Their stable  order is determined by CARD_DEFINITION_ORDER in conflict.py.
        """
        cf = _make_cf(
            personas=["default_general"],
            has_declared_profile=False,
            is_commute_window=False,
            aqi=_sv(50, "live"),
            uv=_sv(3.0, "live"),
            precip_prob_pct=_sv(5, "live"),
        )
        outputs = [rank(cf) for _ in range(5)]
        first_order = [c.card_id for c in outputs[0].ranked_cards]
        for out in outputs[1:]:
            assert [c.card_id for c in out.ranked_cards] == first_order, (
                "Tie-break order must be stable across repeated identical runs."
            )
