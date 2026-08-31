# Project Roadmap

This roadmap reflects the actual repository state.

## 🟩 COMPLETED: Foundation & Backend MVP

**Objective:** Build a robust, scalable backend that handles personalization mathematically.
- **Architecture Baseline:** Project structure, comprehensive markdown planning specs.
- **Personalization Engine:** Pure python scoring models, urgency mapping, conflict resolution, explainability templates. (130+ passing tests).
- **PostgreSQL Foundation:** Neon DB integration via psycopg3 for preference and cache storage.
- **Data Adapters (Phase 1):** Configured standardized interfaces for Forecasts, Warnings, AQI, UV, and Sunlight. Implemented robust simulated fixtures mirroring real-world IMD structures.
- **Backend APIs:** `/homepage`, `/preferences`, `/explain` endpoints running on FastAPI.

## 🟩 COMPLETED: Frontend UI Integration

**Objective:** Build a responsive Next.js client that consumes the FastAPI endpoints and proves the personalization logic visually.
- **Home Feed:** Renders the ranked `cards[]` array from `/homepage`, each tappable to reveal its "why this was ranked" explanation. Personalized/actionable, deliberately distinct from the Weather page's raw metrics.
- **Preferences:** Persona selector + health flags, live homepage reorder on change.
- **Weather Dashboard & Map:** Detailed metrics (temperature, precipitation, rain probability, humidity, wind, hourly/daily forecast) and an interactive map with live per-location weather.
- **Degradation UI:** `system_notice` banner and per-card freshness badges (`live` / `cached` / `stale` / `simulated` / `unavailable`).

## 🟩 COMPLETED: Production Hardening (this pass)

**Objective:** Close the gap between "MVP that runs" and "product that survives real traffic." Full detail in `docs/production_hardening.md`.
- **Correctness:** Fixed a rain-probability bug (adapter always read the wrong hourly index) and a related bug in the map's point forecast.
- **Performance & resilience:** Wired the previously-unused `cache/store.py` into the live Forecast/AQI/UV adapters — cached responses, one retry on failure, stale-cache-before-fixture fallback.
- **Stability:** Fixed an unbounded in-memory dict (`explain_db`) that leaked forever; replaced with a bounded, TTL-evicting store.
- **Abuse protection:** Added per-IP rate limiting to the API.
- **Observability:** Structured logging + a global exception handler (no more leaked stack traces).
- **Frontend resilience:** Added App Router error boundaries (`error.tsx`, `global-error.tsx`, `not-found.tsx`) — no more white-screen crashes.
- **Deployability:** Added `backend/Dockerfile`, `render.yaml`, and a CI pipeline (`.github/workflows/ci.yml`) that runs the full test suite, boundary check, typecheck, lint, and build on every push.

## 🟨 NEXT MILESTONE (CURRENT): Closing the Remaining Production Gaps

See `docs/production_hardening.md` for full detail. In priority order:
- **API authentication** — `/homepage` and `/preferences` are currently open to any caller
- **Shared rate-limit/cache store** — current implementation is correct for one backend process only; needs Redis (or similar) before horizontal scaling
- **Frontend test suite** — no automated frontend tests exist yet
- **`WarningAdapter` live mode** — blocked on securing IMD warning-feed API access; currently fixture-only regardless of `ADAPTER_MODE`
- **`SunAdapter` timezone fix** — hardcodes `Asia/Kolkata`; wrong for the non-India preset cities already in the frontend (London, Tokyo, NYC, Dubai)

## ⬜ FUTURE.1: Persona Expansion

**Objective:** Achieve 100% compliance with SIH26076's recommended 8 personas.
- **Pollen Data Adapter:** Source a reliable Indian pollen index API to finalize the Health persona.
- **Comfort Index:** Mathematical formula combining temp/humidity to support Event Planners.
- **Marine Adapter:** INCOIS integration (or fixtures) for Beachgoers/Surfers.
- **Traveler Logic:** Expand `/preferences` schema to support multi-destination routing.

## ⬜ FUTURE.2: Remaining Production & Live Data Work

**Objective:** Finish the transition from Hackathon MVP to a live, scalable production environment. (AQI/UV hardening, deployment config, and Forecast live-mode are now ✅ — see "Production Hardening" above.)
- **IMD Warning Feed Access:** `WarningAdapter` still has no live mode (fixture-only) — needs official IMD/MoES warning-feed API credentials, which this pass did not have access to.
- **Deploy & verify:** `render.yaml` / `backend/Dockerfile` are written but not yet deployed to a live Render instance; Vercel deploy for the frontend still needs to be run end-to-end.
- **Horizontal scaling prep:** move the rate limiter and explanation cache from in-memory to a shared store (Redis) before running more than one backend worker/replica.
- **Traffic API Exploratory:** Assess non-MoES API dependencies to satisfy commuter traffic requirements without violating project scope.
