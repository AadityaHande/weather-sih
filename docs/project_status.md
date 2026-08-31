# Project Status — Mausam Personalized Homepage

> **Last updated:** 2026-08-31 (post production-hardening pass)
> **Branch:** `milestone-2-adapters-backend`
> **Purpose:** Quick-read current state for any new team member. Read this before reading the planning docs.
> **Product definition:** See [PRD.md](PRD.md) for the whole-product requirements document (vision, personas, functional requirements, KPIs, roadmap).

---

## What This Project Is

An **intelligent personalization layer** for the Mausam mobile app (IMD / MoES).

It answers the question: *given this user's persona and the current environment, what should appear at the top of their weather homepage right now?*

Core mechanics:
- Collect weather/environment signals (AQI, UV, forecast, warnings, sunrise/sunset)
- Assemble a `ContextFrame` per user request
- Score candidate homepage cards: `score = persona_weight × urgency_multiplier × confidence_factor`
- Return a ranked, explained card list via a REST API
- Frontend renders the returned order — no re-ranking in the UI

This is not a replacement weather app. It is a personalization layer.

---

## Completed Work

### Architecture Baseline · `9d471ba`

- Repository structure established
- All planning documents written (`docs/planning/`)
- Adapter interface defined
- Engine contract defined
- API contract defined (`07_api_and_data_contracts.md`)
- No code yet

### Phase 2A · `512a580`

- FastAPI backend scaffolded
- `/preferences` endpoint (GET + PUT)
- PostgreSQL persistence via `psycopg` v3 native driver + connection pool
- Neon-compatible schema (`preferences`, `signal_cache` tables)
- `backend/db.py`, `backend/settings.py`
- CORS configured

### Phase 2B · `128d1aa` — **Current HEAD**

All of the following are implemented and tested:

**Engine (`engine/`) — frozen, unmodified by Phase 2A/2B:**
- 8 card definitions (`cards.py`)
- Scoring function: `persona_weight × urgency × confidence` (`scoring.py`)
- P0–P3 priority classifier + alert-floor rule (`priority.py`)
- Conflict resolver + ranking loop (`engine.py`)
- Templated explanation generator — 8 templates, grounded in real signal values (`explain.py`)
- Data models: `ContextFrame`, `RankedCard`, `EngineOutput` (`models.py`)
- **134 unit + scenario tests** — all passing

**Adapters (`adapters/`):**
- `BaseAdapter` with `make_unavailable_signal()` contract, plus shared signal-cache helpers (`get_fresh_cache`, `get_any_cache`, `set_cache`)
- `ForecastAdapter` — live Open-Meteo (temp, humidity, wind, precip probability), cache-backed with retry + stale-cache fallback; fixture mode still available via `ADAPTER_MODE=fixture`
- `WarningAdapter` — IMD-shaped fixture only; **no live mode** (blocked on IMD warning-feed API access — see `docs/production_hardening.md`)
- `AQIAdapter` — live Open-Meteo Air Quality, cache-backed with retry + stale-cache fallback
- `UVAdapter` — live Open-Meteo, cache-backed with retry + stale-cache fallback
- `SunAdapter` — live computed via `astral` library (no external API); timezone is currently hardcoded to `Asia/Kolkata` regardless of the given lat/lon — see `docs/production_hardening.md`
- Fixture scenarios: `normal`, `rain_commute`, `heat_uv_spike`, `severe_warning`

**Backend API (`backend/`):**
- `GET /homepage` — returns ranked `HomepageResponse` with `cards[]` + `warnings_override[]`
- `GET /explain` — returns `ExplainResponse` with text + signal_refs + score_components (now served from a bounded, TTL-evicting store instead of an unbounded dict)
- `GET /preferences` and `PUT /preferences`
- `GET /health`
- `build_context_frame()` (`backend/deps.py`) — full ContextFrame assembly
- Degraded response handling: `system_notice` for full-layer failure; `source: "unavailable"` on per-card basis
- Global exception handler (clean JSON error responses; full trace logged server-side, never exposed to the client)
- Per-IP rate limiting (60 req/min, in-memory, `/health` exempt)
- Structured logging via Python `logging` (no more raw `print()`)
- **13 backend API tests** — all passing

**Frontend (`frontend/`):**
- Full Next.js App Router client: Home Feed, Weather Dashboard, Weather Map, Explanation Sheet, Preferences/Onboarding, Auth, Settings, Chatbot
- Ranked/explainable priority cards from `/homepage` are rendered on the Home Feed with a tap-to-reveal "why this was ranked" drawer (previously fetched but never displayed)
- App-wide error boundaries (`error.tsx`, `global-error.tsx`, `not-found.tsx`) — a render-time exception now shows a recoverable error screen instead of a white screen
- No automated frontend test suite yet (see `docs/production_hardening.md`)

**Infrastructure:**
- Production boundary checker (`check_boundaries.py`) — confirms the engine stays free of framework/network/I-O dependencies
- `requirements.txt` pinned
- `backend/Dockerfile`, `.dockerignore`, `render.yaml` — backend is now containerized and has a deploy blueprint for the project's documented target platform (Render)
- `.github/workflows/ci.yml` — automates the verification gate below on every push/PR (previously manual-only)
- Live adapters (`ForecastAdapter`, `AQIAdapter`, `UVAdapter`) are cache-backed (`cache/store.py`, previously unused) with retry-once + stale-cache-before-fixture fallback

See **`docs/production_hardening.md`** for the full MVP → production changelog and the prioritized list of what's still open.

---

## Current Architecture State

```
COMPLETE                              OPEN (see docs/production_hardening.md)
────────                              ────
engine/                    ✅          WarningAdapter live mode (needs IMD API access)
adapters/ (live + cached)  ✅          SunAdapter timezone hardcoded to Asia/Kolkata
backend/ (hardened)        ✅          Rate limiter / explain cache are single-process only
cache/store.py (wired in)  ✅          No automated frontend test suite
frontend/ (full app)       ✅          No auth/authorization on the API itself
backend tests              ✅
engine tests               ✅
CI pipeline                ✅
```

---

## Current Supported Personas

| Persona | Supported | Key Cards |
|---|---|---|
| Health-conscious | ✅ | `aqi_health`, `uv_sun_exposure`, `pollen_illustrative`* |
| Outdoor fitness | ✅ | `activity_window`, `uv_sun_exposure`, `sunrise_sunset` |
| Parents & families | ✅ | `rain_commute`, `severe_warning` P0 |
| Default / cold-start | ✅ | `severe_warning` > `general_conditions` > `aqi_health` |

*`pollen_illustrative`: card definition and scoring exist; fixture/adapter not yet implemented — card always omitted in current build due to null pollen signal.

---

## Intentionally Deferred

These items were explicitly excluded from the Phase 2B MVP scope (see `docs/planning/00_project_decision_log.md` Decision D4 and `docs/planning/13_final_mvp_specification.md §52`):

- **Beachgoer / marine persona** — no public INCOIS developer API available; fixture card possible for demo
- **Traveler persona** — saved_locations field present in schema, but no multi-destination routing
- **Agriculture persona** — no accessible agromet / soil-moisture data source for students
- **Commuter (traffic)** — weather + traffic integration requires external traffic API (outside IMD scope)
- **Event planner** — multi-day forecast + comfort index not implemented
- **Pollen adapter** — no validated Indian pollen data source; card gated/illustrative

✅ *No longer deferred:* live adapter hardening (timeouts, one retry, cache-backed fallback for AQI/UV/Forecast) was implemented in the production-hardening pass — see `docs/production_hardening.md`.

---

## Known Gaps

| Gap | Severity | Notes |
|---|---|---|
| `WarningAdapter` has no live mode | **High** | Always fixture data — the most safety-critical card (P0 severe warnings) is never real. Blocked on IMD warning-feed API access; see `docs/production_hardening.md` |
| Rate limiter / explain cache are single-process only | Moderate | Fine for one backend worker; needs a shared store (e.g. Redis) before scaling to multiple workers/replicas |
| No automated frontend test suite | Moderate | Backend/engine has 149 passing tests; frontend has none yet |
| No auth/authorization on the API | Moderate | `/homepage`, `/preferences` etc. are open — anyone with the URL can call them |
| `SunAdapter` hardcodes `Asia/Kolkata` | Low | Sunrise/sunset would be wrong for the non-India preset cities already in the frontend (London, Tokyo, NYC, Dubai) |
| Pollen fixture missing | Low | Health persona feels incomplete without it |
| Comfort index not implemented | Low | Addresses event-planner PS persona |
| Marine/beachgoer card absent | Low | Addresses beachgoer PS persona with minimal effort |

---

## Immediate Next Milestone — Production Hardening

The frontend is now fully built (Home Feed, Weather Dashboard, Weather Map, Explanation Sheet, Preferences, Auth). The next milestone is closing the gaps in the table above, roughly in this order:

1. **API authentication** — `/homepage` and `/preferences` are currently open to anyone with the URL
2. **Shared rate-limit/cache store** — required before running more than one backend process
3. **Frontend test suite** — component/integration tests for Home Feed, Weather page, Map
4. **`WarningAdapter` live mode** — requires securing IMD warning-feed API access
5. **`SunAdapter` timezone fix** — derive timezone from lat/lon instead of hardcoding `Asia/Kolkata`

See [docs/production_hardening.md](production_hardening.md) for full detail on each item, and [docs/frontend_handoff.md](frontend_handoff.md) for the original frontend developer guide.

---

## Git Milestone References

| Commit | Description |
|---|---|
| `9d471ba` | Architecture baseline |
| `512a580` | Phase 2A — PostgreSQL foundation + preferences API |
| `128d1aa` | Phase 2B — fixture adapters + personalized homepage API |
| *(this pass)* | Rain/precip bug fixes, Home Feed redesign, Map live-data wiring, production hardening (caching, rate limiting, error boundaries, CI/CD) — see `docs/production_hardening.md` |

---

## Test Commands (Verification Gate)

Automated on every push/PR via `.github/workflows/ci.yml`. To run locally:

```bash
# Full backend/engine/adapter/cache suite — 149 tests
ADAPTER_MODE=fixture FIXTURE_SCENARIO=normal python -m pytest engine/tests backend/tests adapters/tests cache/tests -v

# Production boundary check
python check_boundaries.py

# Frontend typecheck, lint, build
cd frontend
npx tsc --noEmit
npm run lint
npm run build

# Git cleanliness
git diff --check
git status --short engine    # should return nothing (engine frozen)
```
