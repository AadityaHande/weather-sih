# 16 — Production Architecture Reassessment

Cross-checked against `14_implementation_blueprint.md`, `15_implementation_completion_and_handoff.md`, `08_data_source_and_integration_plan.md`, `11_development_and_deployment_guide.md`, `07_api_and_data_contracts.md`, and `06_system_architecture.md`. This document is authoritative for all persistence, deployment, security, and adapter-hardening decisions. Where it conflicts with an earlier document, this file wins.

---

## 1. Persistence Layer Reassessment

### 1.1 Problem with SQLite in the original plan

`14_implementation_blueprint.md` §7 selected SQLite (`sqlite3`, file-based) for both the `preferences` and `signal_cache` tables. This is correct for local development but **does not survive Render's ephemeral filesystem**: every redeploy, restart, or free-tier spin-down destroys `app.db`, resetting all preferences and cached signals. In a live demo, this means a persona change made 5 minutes before going on stage could silently disappear.

### 1.2 Decision: Neon (serverless Postgres)

**Persistence layer for the deployed backend: Neon PostgreSQL (serverless, free tier).**

Rationale:
- Neon's free tier is sufficient for 2 tables, ~1 MB of data, and hackathon traffic patterns.
- Data persists across all Render events (redeploy, restart, idle spin-down) because it lives in Neon, not on Render's disk.
- Neon provides a pooled connection string that works with `psycopg` (v3) with zero additional infra.
- No ORM is introduced — schema is expressed as `CREATE TABLE IF NOT EXISTS` in `init_db()`, consistent with the "lightweight, no framework deps" principle throughout the stack.

The two-table schema from `14_...md` §7 is **unchanged**:
```sql
CREATE TABLE IF NOT EXISTS preferences (
  device_id TEXT PRIMARY KEY,
  personas TEXT NOT NULL,           -- JSON array
  health_flags TEXT NOT NULL,       -- JSON array
  saved_locations TEXT,             -- JSON array, nullable
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signal_cache (
  cache_key TEXT PRIMARY KEY,       -- e.g. "aqi:18.52:73.86"
  value_json TEXT NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
```

### 1.3 Driver change: `sqlite3` → `psycopg` (v3)

`backend/db.py` for the **deployed** backend uses `psycopg` (v3) against the Neon pooled connection string. `requirements.txt` gains:
```
psycopg[binary,pool]==3.2.*
```

The `get_connection()` and `init_db()` function signatures are **identical** to the SQLite reference implementation in `15_...md` §4, but the internal driver changes to `psycopg`. SQL placeholder syntax uses `%s` (psycopg). `init_db()` is called at startup via FastAPI lifespan or `@app.on_event("startup")`.

**PostgreSQL (psycopg) is the persistence layer for BOTH local development and production.** Do not introduce SQLite as a fallback. For local testing, use a local PostgreSQL container or a Neon development branch. The `DATABASE_URL` must always point to a PostgreSQL instance.

---

## 2. Hosting Stack

| Layer | Service | Tier | Notes |
|---|---|---|---|
| Frontend | **Vercel** | Free | Next.js App Router, zero-config, auto-deploys from `main` |
| Backend | **Render** (primary) | Free | Web Service, cold-start after inactivity — mitigated by `/health` pre-warm (§4.3) |
| Backend fallback | **Railway** | Hobby (~$5/mo) | Switch if Render free-tier cold-start proves disruptive during live rehearsals |
| Database | **Neon** | Free | Serverless Postgres, pooled connection, persistent across Render events |

**Why Render over Railway as primary:** Render's free web service has no monthly hour cap (Railway's free tier has a 500-hour/month cap that can be exhausted by background test deploys). Railway is the fallback specifically because its paid tier eliminates cold-start concerns entirely.

---

## 3. Adapter-Level Production Hardening

Each adapter that makes a live network call (`AQIAdapter`, `UVAdapter`) must enforce the following constraints to prevent a slow or failing external API from causing the backend to return a 5xx or hang:

| Parameter | Value | Rationale |
|---|---|---|
| Connection timeout | 5 s | Prevents DNS/TCP hang from blocking the request thread indefinitely |
| Read timeout | 10 s | Gives the response time to arrive; bounded so total latency stays acceptable |
| Retries | 1 retry on `TimeoutError` / 5xx, 0.5 s back-off | Handles transient hiccups; does not mask a real outage |
| Fallback on exhaustion | Next entry in `08_...md` §2 source hierarchy | Never raises an uncaught exception to the backend |

These are **adapter-internal** — the engine, the backend contract (`07_...md`), and the card priority logic are unchanged. The only visible product effect is that a signal that would previously have produced a `TimeoutError` traceback now produces `source: "cached"` (if a prior fetch succeeded) or `source: "unavailable"` (if the cache is also empty).

Implementation sketch for `AQIAdapter.fetch()`:
```python
import requests
from requests.exceptions import Timeout, HTTPError

TIMEOUT = (5, 10)   # (connect_timeout_s, read_timeout_s)
MAX_RETRIES = 1

def _get_with_retry(url, params, headers):
    for attempt in range(MAX_RETRIES + 1):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
            r.raise_for_status()
            return r
        except (Timeout, HTTPError) as e:
            if attempt == MAX_RETRIES:
                raise
            time.sleep(0.5)
```

The same pattern applies to `UVAdapter`. `SunAdapter` is a local computation — no network call, no timeout needed.

---

## 4. API and Security Hardening

### 4.1 Input validation (backend)

Beyond the `validate_context_frame()` call from `14_...md` §3, the backend adds explicit Pydantic v2 guards on all query/body parameters:

- `lat` / `lon`: validated as `float` with `ge=-90, le=90` / `ge=-180, le=180` range constraints respectively.
- `device_id`: validated as `str` with `min_length=1, max_length=128` — rejects empty strings and unbounded inputs.
- `PUT /preferences` body: `personas` and `health_flags` validated as `list[str]` with a `max_length` guard on each element (e.g., 64 chars) — prevents unbounded writes to the Neon DB.

These guards are defined in `backend/models_api.py` Pydantic models. A validation failure returns a standard FastAPI 422 response, which the frontend must handle gracefully (e.g., treat as a transient error, not a crash).

### 4.2 CORS (environment-driven)

`backend/main.py`'s `CORSMiddleware` `allow_origins` list is **not hardcoded** — it is read from the `CORS_ALLOWED_ORIGINS` environment variable (comma-separated list of origin strings):

```python
import os
origins = [o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "PUT"], allow_headers=["*"])
```

This means a Vercel URL rotation (e.g., a preview deployment URL) is a Render dashboard env-var update, not a code change + redeploy.

**Deployed Render value for `CORS_ALLOWED_ORIGINS`:**
```
http://localhost:3000,https://<your-vercel-app>.vercel.app
```
(Populate the Vercel URL after the first Vercel deploy, per `15_...md` §6.2 step 6.)

### 4.3 Health endpoint

`GET /health` is added to `backend/main.py` as a lightweight readiness check:

```python
@app.get("/health")
def health():
    try:
        # Attempt a trivial DB round-trip to confirm Neon connectivity
        with get_connection() as conn:
            conn.execute("SELECT 1")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "degraded", "db": str(e)}, 503
```

Uses:
1. **Pre-demo warm-up:** curl `GET /health` 10–15 min before going on stage to wake the Render free-tier instance from cold-start.
2. **Render health check:** configure Render's health-check path to `/health` so Render knows when the instance is ready to receive traffic after a redeploy.
3. **Debugging:** a quick first check when anything seems wrong with the deployed backend.

---

## 5. Environment Variable Reference (deployed)

### 5.1 Render (backend)

| Variable | Example value | Notes |
|---|---|---|
| `ADAPTER_MODE` | `live` | Use `fixture` for a rehearsal without real API calls |
| `FIXTURE_SCENARIO` | `normal` | Ignored when `ADAPTER_MODE=live`; controls forecast/warning fixture |
| `AQI_DATA_GOV_IN_KEY` | `<key>` | Primary AQI source |
| `AQI_AQICN_TOKEN` | `<token>` | Fallback AQI source |
| `OWM_API_KEY` | `<key>` | UV index source |
| `DATABASE_URL` | `postgresql://<user>:<pass>@<neon-host>/<db>?sslmode=require` | Neon pooled connection string |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,https://<your-vercel-app>.vercel.app` | Comma-separated; update after Vercel deploy |

### 5.2 Vercel (frontend)

| Variable | Example value | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://<your-render-service>.onrender.com` | Set after Render deploy; must NOT be `localhost` in production |

---

## 6. Malformed-Data Hardening (Adapter Output)

Each adapter's `fetch()` method must validate its own output before returning a `SignalValue`. Rationale: external APIs occasionally return an HTTP 200 with a malformed or empty payload, which will produce a `KeyError` or `AttributeError` deep in the engine if it reaches `rank()` unguarded.

Required guard in every live adapter:
```python
def _parse_or_unavailable(raw_json: dict, extract_fn) -> SignalValue:
    """Safely extract a value from raw API JSON, falling back to unavailable."""
    try:
        value = extract_fn(raw_json)
        if value is None:
            raise ValueError("null value")
        return SignalValue(value=value, source="live", freshness_min=0, confidence=1.0)
    except (KeyError, ValueError, TypeError):
        return SignalValue(value=None, source="unavailable", freshness_min=None, confidence=0.0)
```

This keeps the engine's `ContextFrame` contract clean: every `SignalValue` in the frame is either valid + populated or explicitly `unavailable`, never partially structured.

---

## 7. Revised Risk Register (persistence-specific)

| Risk | Original status | Updated status |
|---|---|---|
| R-P1: Render ephemeral disk resets preferences mid-demo | **Active** (SQLite plan) | **Resolved** — preferences in Neon survive all Render events |
| R-P2: Neon free tier exhausted by test traffic | New | **Low** — 2 tables, small payloads; free tier is 0.5 GB storage / 190 compute-hours/month; no realistic path to exhaustion in a 5-day build + demo |
| R-P3: Neon cold-start latency adds to first-request time | New | **Mitigated** — Neon's serverless pool keeps connections warm; first-request latency is dominated by Render's cold-start, not Neon's |
| R-P4: psycopg v3 API unfamiliar to team | New | **Low** — only `backend/db.py` touches it directly; the rest of the backend uses the same `get_connection()` wrapper as before |
| R-P5: Railway fallback adds cost if needed | New | **Accepted** — ~$5/month is within typical hackathon budget; decision to switch, if made, requires only a `uvicorn` start-command update on Railway and a `NEXT_PUBLIC_API_BASE_URL` update on Vercel |

---

*Last updated: Architecture Reconciliation pass — this document supersedes the SQLite/ephemeral-host decisions in `14_implementation_blueprint.md` §7 and `15_implementation_completion_and_handoff.md` §4–§5 for the deployed backend.*
