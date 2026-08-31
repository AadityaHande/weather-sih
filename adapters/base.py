import json
from abc import ABC, abstractmethod
import datetime
from engine.models import SignalValue
import logging

logger = logging.getLogger(__name__)

class Adapter(ABC):
    @abstractmethod
    def fetch(self, lat: float, lon: float, when: datetime.datetime) -> any:
        pass

    def make_unavailable_signal(self) -> SignalValue:
        return SignalValue(value=None, source="unavailable", freshness_min=None, confidence=0.0)

    def load_fixture(self, filepath: str) -> dict:
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load fixture {filepath}: {e}")
            return None

    # ------------------------------------------------------------------
    # Shared signal-cache helpers for live adapters.
    #
    # `cache/store.py` already implements a durable (Postgres-backed, with
    # an in-memory fallback) signal cache keyed by lat/lon, but until now
    # it was never wired into any adapter -- every live request re-hit the
    # upstream API on every single `/homepage` call. These helpers let a
    # live adapter check a fresh cache entry before making a network call,
    # and fall back to a *stale* cache entry (rather than jumping straight
    # to simulated fixture data) if the live call fails.
    # ------------------------------------------------------------------

    def get_fresh_cache(self, prefix: str, lat: float, lon: float, max_age_min: int = 15) -> dict | None:
        """Returns the cached entry only if it is not older than max_age_min."""
        try:
            from cache.store import store as cache_store
        except Exception:
            return None
        cached = cache_store.get(prefix, lat, lon)
        if cached and cached.get("fetched_at") and not cache_store.is_stale(cached["fetched_at"], max_age_min=max_age_min):
            return cached
        return None

    def get_any_cache(self, prefix: str, lat: float, lon: float) -> dict | None:
        """Returns the cached entry regardless of age (used as a last-resort
        fallback, preferred over simulated fixture data when a live call fails)."""
        try:
            from cache.store import store as cache_store
        except Exception:
            return None
        return cache_store.get(prefix, lat, lon)

    def set_cache(self, prefix: str, lat: float, lon: float, value, source: str, confidence: float, freshness_min: int | None = 0) -> None:
        try:
            from cache.store import store as cache_store
            cache_store.set(prefix, lat, lon, json.dumps(value), source, confidence, freshness_min)
        except Exception as e:
            logger.warning(f"Failed to write signal cache for '{prefix}': {e}")
