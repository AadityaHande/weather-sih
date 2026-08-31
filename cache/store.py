import json
import datetime
from backend.db import get_connection

class CacheStore:
    def __init__(self):
        pass

    def get(self, prefix: str, lat: float, lon: float) -> dict | None:
        """Returns the signal cache dict if present"""
        cache_key = f"{prefix}:{lat:.2f}:{lon:.2f}"
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT value_json, source, fetched_at, confidence, freshness_min FROM signal_cache WHERE cache_key=%s",
                        (cache_key,)
                    )
                    row = cur.fetchone()
                    if row:
                        return {
                            "value": json.loads(row[0]),
                            "source": row[1],
                            "fetched_at": row[2],
                            "confidence": row[3],
                            "freshness_min": row[4]
                        }
        except Exception:
            pass

        from backend.db import _in_memory_cache
        return _in_memory_cache.get(cache_key)

    def set(self, prefix: str, lat: float, lon: float, value_json: str, source: str, confidence: float, freshness_min: int | None = None) -> None:
        cache_key = f"{prefix}:{lat:.2f}:{lon:.2f}"
        fetched_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        from backend.db import _in_memory_cache
        _in_memory_cache[cache_key] = {
            "value": json.loads(value_json) if isinstance(value_json, str) else value_json,
            "source": source,
            "fetched_at": fetched_at,
            "confidence": confidence,
            "freshness_min": freshness_min
        }

        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO signal_cache (cache_key, value_json, source, fetched_at, confidence, freshness_min)
                           VALUES (%s, %s, %s, %s, %s, %s)
                           ON CONFLICT(cache_key) DO UPDATE SET
                             value_json=EXCLUDED.value_json, source=EXCLUDED.source,
                             fetched_at=EXCLUDED.fetched_at, confidence=EXCLUDED.confidence,
                             freshness_min=EXCLUDED.freshness_min""",
                        (cache_key, value_json, source, fetched_at, confidence, freshness_min)
                    )
                conn.commit()
        except Exception:
            pass

    def is_stale(self, fetched_at_iso: str, max_age_min: int = 60) -> bool:
        """Checks if a given fetched_at iso string is older than max_age_min"""
        try:
            dt = datetime.datetime.fromisoformat(fetched_at_iso)
            now = datetime.datetime.now(datetime.timezone.utc)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=datetime.timezone.utc)
            return (now - dt).total_seconds() > (max_age_min * 60)
        except ValueError:
            return True

store = CacheStore()
