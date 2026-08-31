# MVP → Production: What Changed, and What's Left

This document answers one question: **"what does this project need to go from a working hackathon MVP to something you'd trust in production?"** It covers what was actually implemented in this pass, verified against the existing test suite plus targeted new checks, and — just as importantly — what was *not* done and why, so the next person doesn't have to rediscover it.

Nothing here touches the personalization engine's logic (`engine/`), which stays frozen per the project's own architecture rule enforced by `check_boundaries.py`.

---

## 1. Correctness bugs fixed

| Bug | Where | Fix |
|---|---|---|
| Rain probability always read the wrong hour | `adapters/forecast_adapter.py` | Was indexing `hourly.precipitation_probability[0]` unconditionally — index 0 is the first hour of the returned window (effectively midnight), not "now". Now matches the hourly index against `current.time`. |
| Same bug in the map's point forecast | `frontend/src/app/map/page.tsx` | Same fix applied to the 12-hour forecast slice for a clicked map point. |
| AQI/UV hardcoded in Home Feed persona insights | `frontend/src/app/home/page.tsx` | Was passing literal `aqi={65}` / `uvIndex={6.5}` — coincidentally the component's own fallback defaults — instead of live data. Now fetched from the same Open-Meteo Air Quality API already used elsewhere in the app. |

Verified with mocked-network simulations (not just unit tests) showing the correct hourly index is picked and the correct probability value flows through.

---

## 2. Product gap: Home Feed duplicated the Weather page

The backend already computes ranked, explainable, persona-weighted priority cards (`GET /homepage`) — this *is* the product's core value proposition per its own docs ("same weather data → different card order/alerts per persona, transparently, with an audit trail"). But the frontend never rendered them: `getPersonaCardConfig()` and a fully-built explanation drawer existed as dead code, while the Home Feed instead showed a near-duplicate of the Weather page's metrics grid (temp, humidity, wind, UV, rain — all a second time).

Fixed by wiring the ranked cards into the Home Feed (tap a card → see why it was ranked) and shrinking the duplicate metrics grid to a one-line summary. Persona switching and all existing persona logic were preserved as-is.

---

## 3. Reliability & performance

**Dead cache, now wired in.** `cache/store.py` — a full Postgres-backed signal cache with an in-memory fallback — existed and had its own passing test suite, but was never called from anywhere. Every single `/homepage` request re-hit the Forecast, AQI, and UV APIs from scratch, with no caching at all.

Fixed: added shared cache helpers to `adapters/base.py` and wired them into all three live adapters —
- Serve from cache if the entry is fresh (<15 min for AQI/UV, <10 min for forecast).
- One retry on a live-fetch failure.
- On failure after retry, fall back to a **stale cache entry** (marked `source: "stale"`, which the frontend already has a badge for) rather than jumping straight to simulated fixture data.

Verified with mocked-network tests: confirmed zero extra network calls on a cache hit, and confirmed the stale-fallback path returns the last real value (not a fixture placeholder) when the network is down.

**Unbounded memory leak.** `backend/routers/homepage.py` kept every card explanation in a plain `dict` (`explain_db`) for the lifetime of the process — roughly 8 new entries per homepage load, never evicted. On a long-running server this grows without bound. Replaced with a bounded (5,000 entries), TTL-evicting (30 min) LRU store with the same `in` / `[]` interface, so `backend/routers/explain.py` needed no changes. Verified eviction and expiry behavior directly.

---

## 4. Resilience & operability

- **Rate limiting.** `/homepage` fans out to 3 external APIs per request with no throttling — a real abuse and cost vector. Added a simple in-memory sliding-window limiter (60 req/min per IP, `/health` and docs exempt). Verified it returns `429` at exactly the right request count and never throttles health checks.
- **Structured logging.** `backend/main.py` used raw `print()` for startup/shutdown warnings. Replaced with Python's `logging` module, consistent with what `backend/db.py` already did.
- **Global exception handler.** An unhandled exception previously surfaced as FastAPI's default error response. Added a handler that logs the full exception server-side and returns a clean, generic JSON error to the client — no stack traces or internals leak out.
- **Frontend error boundaries.** The Next.js app had zero error boundaries — any render-time exception (a malformed API response, a null dereference) would white-screen the entire app. Added `error.tsx`, `global-error.tsx`, and `not-found.tsx`, styled to match the existing design system, each with a recovery action.

---

## 5. Deployability

None of the following existed before this pass:

- **`backend/Dockerfile`** — production image for the FastAPI backend, with a `.dockerignore` to keep the build context lean.
- **`render.yaml`** — deployment blueprint for Render, the platform the project's own roadmap already named as the target. Secrets are marked `sync: false` so they're entered in Render's dashboard, never committed.
- **`.github/workflows/ci.yml`** — automates the "Verification Gate" that `docs/project_status.md` already documented as a manual checklist: the full pytest suite, the architectural boundary check, frontend typecheck, lint, and build, on every push/PR.

Not done: an actual live deploy to Render/Vercel. The configs are written and the Docker build was validated by installing `requirements.txt` cleanly and reviewing the image layer-by-layer (Docker itself wasn't available in this environment to run a live `docker build`), but nobody has run `render.yaml` against a real Render account yet.

---

## 6. What's still open, in priority order

### High priority

**`WarningAdapter` has no live mode at all.** Every other adapter now has a live path; this one always returns fixture data regardless of `ADAPTER_MODE`. This is the single most safety-critical card in the system — P0 severe weather warnings — and it's currently always simulated. This wasn't something I could fix in this pass: it requires official IMD/MoES warning-feed API credentials, which I don't have access to. The project's own roadmap already flagged this as "IMD API Whitelisting" under FUTURE.2.

**No API authentication.** `/homepage`, `/preferences`, and `/explain` are all open to any caller with the URL. There's no API key, session token, or device-id verification beyond trusting the client-supplied `device_id` string at face value. Before any real deployment, at minimum the write endpoint (`PUT /preferences`) needs some form of caller verification.

### Medium priority

**Rate limiter and explanation cache are single-process state.** Both are correct and tested for a single backend worker, but store their state in a plain Python dict in memory. The moment you run more than one worker or replica (which you'd want for real traffic), each process has its own independent rate-limit counter and explanation cache — a client could bypass the rate limit by hitting a different worker, and an `/explain` lookup could 404 if it lands on a worker that didn't serve the original `/homepage` request. Fix: move both to Redis (or the existing Postgres `signal_cache` table) before scaling horizontally.

**No automated frontend tests.** The backend/engine/adapter/cache layers have 149 passing tests. The frontend — a substantial Next.js app with real business logic (persona insight scoring, card rendering, explanation drawers) — has none. Recommend starting with component tests for `PersonaInsightsSection` and the new ranked-card list, since those directly drive what a user sees.

### Lower priority

**`SunAdapter` hardcodes `Asia/Kolkata`.** Sunrise/sunset math uses a fixed IST timezone regardless of the `lat`/`lon` passed in. This is arguably correct for the project's stated India/IMD focus, but the frontend's Weather page already supports non-India preset cities (London, Tokyo, New York, Dubai), so daylight-hours cards for those locations would currently be wrong. Left unfixed because it's outside the five tasks originally scoped and touches timezone-derivation logic that has a wider blast radius than a contained fix.

**Persona expansion** (pollen adapter, comfort index, marine/beachgoer, traveler multi-destination) — all pre-existing, explicitly deferred items from the original MVP scope decision log, unrelated to production-readiness.

---

## Verification performed

- Full test suite (149 tests: engine, backend, adapters, cache) — passing before and after every change in this pass.
- `check_boundaries.py` — passing (engine package still has zero framework/network/I-O imports).
- Frontend: `npx tsc --noEmit` — zero errors across the whole app.
- Targeted live-mode simulations with mocked network calls for: rain-hour-index correctness, cache-hit avoids network call, stale-cache fallback returns real (not fixture) data, rate limiter triggers at the correct threshold and exempts `/health`, bounded explain store evicts oldest entries and expires by TTL.

Nothing here was deployed or run against a real network/database — this environment's network access is restricted to package registries (npm/pip), so all "live" adapter behavior was verified with mocked HTTP responses rather than the real Open-Meteo API.
