import pytest
from cache.store import CacheStore

def test_cache_store_set_and_get():
    cache = CacheStore()
    cache.set("test_sig", 28.61, 77.20, '{"aqi": 120}', "simulated", 0.8, 5)
    
    val = cache.get("test_sig", 28.61, 77.20)
    assert val is not None
    assert val["value"] == {"aqi": 120}
    assert val["source"] == "simulated"
    assert val["confidence"] == 0.8

def test_cache_store_staleness():
    cache = CacheStore()
    import datetime
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    assert not cache.is_stale(now_iso, max_age_min=60)
    
    old_iso = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=120)).isoformat()
    assert cache.is_stale(old_iso, max_age_min=60)
