"""
engine/tests/conftest.py

Shared pytest fixtures for the Mausam engine test suite.

All test scenarios are built from ContextFrame objects populated here.
Using fixtures avoids repeating large dictionaries in every test file
and ensures all tests use valid, consistent ContextFrames.

Scenarios modelled after 03_personalization_logic_and_decision_matrix.md
Example Scenarios A and B, plus boundary/degraded cases.
"""
import pytest

from engine.models import ContextFrame, SignalValue


# ---------------------------------------------------------------------------
# Signal factories — small helpers to reduce ContextFrame verbosity
# ---------------------------------------------------------------------------

def live(value, freshness_min: int = 5) -> SignalValue:
    """A fresh live signal."""
    return SignalValue(value=value, source="live", freshness_min=freshness_min, confidence=1.0)


def simulated(value) -> SignalValue:
    """A simulated/fixture signal (e.g. IMD forecast data)."""
    return SignalValue(value=value, source="simulated", freshness_min=0, confidence=0.7)


def stale(value) -> SignalValue:
    """A stale cached signal (beyond freshness threshold)."""
    return SignalValue(value=value, source="stale", freshness_min=360, confidence=0.3)


def cached(value) -> SignalValue:
    """A recently-cached signal (live fetch failed, but cache is fresh)."""
    return SignalValue(value=value, source="cached", freshness_min=30, confidence=0.9)


def unavailable() -> SignalValue:
    """A completely unavailable signal."""
    return SignalValue(value=None, source="unavailable", freshness_min=None, confidence=0.0)


def aqi_live(aqi_int: int, dominant: str = "pm2.5") -> SignalValue:
    """AQI as a live composite signal with the canonical dict format."""
    return SignalValue(
        value={"aqi": aqi_int, "dominant": dominant},
        source="live",
        freshness_min=10,
        confidence=1.0,
    )


def aqi_simulated(aqi_int: int, dominant: str = "pm2.5") -> SignalValue:
    return SignalValue(
        value={"aqi": aqi_int, "dominant": dominant},
        source="simulated",
        freshness_min=0,
        confidence=0.7,
    )


# ---------------------------------------------------------------------------
# Base context builder
# ---------------------------------------------------------------------------

def _base(
    personas: list[str],
    health_flags: list[str] | None = None,
    has_declared: bool = True,
    is_commute: bool = False,
    is_daylight: bool = True,
    warnings: list[dict] | None = None,
    aqi=None,
    uv=None,
    temp_c=None,
    humidity_pct=None,
    wind_kmh=None,
    precip_prob_pct=None,
    pollen=None,
    local_time: str = "2026-08-26T10:00:00+05:30",
) -> ContextFrame:
    """Build a fully-populated ContextFrame with sensible defaults."""
    return ContextFrame(
        personas=personas,
        health_flags=health_flags or [],
        has_declared_profile=has_declared,
        local_time=local_time,
        is_commute_window=is_commute,
        is_daylight=is_daylight,
        lat=18.5204,
        lon=73.8567,
        location_name="Pune",
        temp_c=temp_c if temp_c is not None else live(28.0),
        feels_like_c=live(30.0),
        humidity_pct=humidity_pct if humidity_pct is not None else live(65),
        wind_kmh=wind_kmh if wind_kmh is not None else live(14.0),
        precip_prob_pct=precip_prob_pct if precip_prob_pct is not None else simulated(20),
        warnings=warnings if warnings is not None else [],
        aqi=aqi if aqi is not None else aqi_live(96),
        uv=uv if uv is not None else live(6.0),
        pollen=pollen,
        sunrise="06:10",
        sunset="18:55",
    )


# ---------------------------------------------------------------------------
# Named scenario fixtures that tests import directly
# ---------------------------------------------------------------------------

@pytest.fixture
def cf_cold_start():
    """Cold-start user: no declared profile, default_general persona."""
    return _base(
        personas=["default_general"],
        health_flags=[],
        has_declared=False,
    )


@pytest.fixture
def cf_health_moderate():
    """Health persona, moderate AQI (96), moderate UV (6)."""
    return _base(
        personas=["health"],
        health_flags=["respiratory_sensitive"],
        aqi=aqi_live(96),
        uv=live(6.0),
    )


@pytest.fixture
def cf_health_high_aqi():
    """Health persona, high AQI (178, Poor), high UV (9)."""
    return _base(
        personas=["health"],
        health_flags=["respiratory_sensitive"],
        aqi=aqi_live(178),
        uv=live(9.0),
    )


@pytest.fixture
def cf_fitness_high_uv():
    """Fitness persona, Very High UV (9), moderate AQI."""
    return _base(
        personas=["fitness"],
        health_flags=[],
        aqi=aqi_live(96),
        uv=live(9.0),
    )


@pytest.fixture
def cf_fitness_good_conditions():
    """Fitness persona, good morning conditions — low UV, clean air."""
    return _base(
        personas=["fitness"],
        health_flags=[],
        aqi=aqi_live(50),
        uv=live(2.0),
        local_time="2026-08-26T07:00:00+05:30",
    )


@pytest.fixture
def cf_family_commute_rain():
    """Family persona, commute window active, high rain probability."""
    return _base(
        personas=["family"],
        health_flags=[],
        is_commute=True,
        precip_prob_pct=simulated(70),
    )


@pytest.fixture
def cf_family_no_rain():
    """Family persona, commute window, low rain probability."""
    return _base(
        personas=["family"],
        health_flags=[],
        is_commute=True,
        precip_prob_pct=simulated(10),
    )


@pytest.fixture
def cf_severe_warning():
    """Any persona with an active P0 severe thunderstorm warning."""
    return _base(
        personas=["fitness"],
        health_flags=[],
        warnings=[{
            "severity": "red",
            "type": "thunderstorm",
            "text": "Severe thunderstorm warning: strong winds and lightning expected.",
        }],
    )


@pytest.fixture
def cf_aqi_missing():
    """Fitness persona, AQI signal unavailable."""
    return _base(
        personas=["fitness"],
        health_flags=[],
        aqi=unavailable(),
        uv=live(5.0),
    )


@pytest.fixture
def cf_stale_aqi():
    """Health persona, AQI signal is stale (6-hour-old cache)."""
    return _base(
        personas=["health"],
        health_flags=["respiratory_sensitive"],
        aqi=SignalValue(
            value={"aqi": 160, "dominant": "pm2.5"},
            source="stale",
            freshness_min=360,
            confidence=0.3,
        ),
        uv=live(5.0),
    )


@pytest.fixture
def cf_all_unavailable():
    """Extreme degradation: all environmental signals unavailable."""
    return ContextFrame(
        personas=["default_general"],
        health_flags=[],
        has_declared_profile=False,
        local_time="2026-08-26T10:00:00+05:30",
        is_commute_window=False,
        is_daylight=True,
        lat=18.52,
        lon=73.86,
        location_name="Pune",
        temp_c=unavailable(),
        feels_like_c=unavailable(),
        humidity_pct=unavailable(),
        wind_kmh=unavailable(),
        precip_prob_pct=unavailable(),
        warnings=[],
        aqi=unavailable(),
        uv=unavailable(),
        pollen=None,
        sunrise="06:10",
        sunset="18:55",
    )


@pytest.fixture
def cf_pollen_opt_in():
    """Health persona, pollen_interest flag, simulated pollen data."""
    return _base(
        personas=["health"],
        health_flags=["respiratory_sensitive", "pollen_interest"],
        pollen=SignalValue(value="Moderate", source="simulated", freshness_min=0, confidence=0.7),
    )


@pytest.fixture
def cf_pollen_no_flag():
    """Health persona, but pollen_interest NOT in health_flags — pollen card gated."""
    return _base(
        personas=["health"],
        health_flags=["respiratory_sensitive"],   # no pollen_interest
        pollen=SignalValue(value="Moderate", source="simulated", freshness_min=0, confidence=0.7),
    )


@pytest.fixture
def cf_same_weather_health():
    """
    Scenario A (03_...md §82): same weather, health persona.
    AQI 165, UV 9, light rain in 2h.
    """
    return _base(
        personas=["health"],
        health_flags=["respiratory_sensitive"],
        aqi=aqi_live(165),
        uv=live(9.0),
        precip_prob_pct=simulated(40),
    )


@pytest.fixture
def cf_same_weather_fitness():
    """Scenario A: same weather, fitness persona."""
    return _base(
        personas=["fitness"],
        health_flags=[],
        aqi=aqi_live(165),
        uv=live(9.0),
        precip_prob_pct=simulated(40),
    )


@pytest.fixture
def cf_same_weather_family():
    """
    Scenario A: same weather, family persona (commute window active).

    Uses simulated(60) for precip — IMD rain data is simulated per 13_...md.
    60% probability triggers the commute + ≥60% urgency band (urgency=2.35
    after F-01 calibration fix):

        score = 0.95 × 2.35 × 0.7 = 1.56275 → P1 ✅

    This matches 03_...md §88: 'Rain card → P1'.

    Audit F-01 resolution: the urgency was 2.0 (a placeholder per 15_...md),
    which gave 0.95 × 2.0 × 0.7 = 1.33 < 1.5 (P2, not P1). The placeholder
    was calibrated to 2.35 — see docs/IMPL_CALIBRATION_DECISIONS.md CAL-01.
    """
    return _base(
        personas=["family"],
        health_flags=[],
        aqi=aqi_live(165),
        uv=live(9.0),
        precip_prob_pct=simulated(60),   # simulated IMD rain, 60% → commute urgency=2.35
        is_commute=True,
    )

