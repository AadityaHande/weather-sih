# 11 — Development and Deployment Guide

Practical setup guide, consistent with `06_system_architecture.md` module boundaries.

## 1. Recommended Repository Structure
```
/engine/            # Personalization Engine — pure logic, zero I/O, zero framework deps
   scoring.*
   priority.*
   explain.*
   context_frame.schema.*
   /tests/           # unit tests (10_testing_and_validation_plan.md §1)
/adapters/
   aqi_adapter.*
   uv_adapter.*
   sun_adapter.*
   forecast_adapter.*     # simulated, IMD-shaped
   warning_adapter.*      # simulated, IMD-shaped
   /fixtures/              # forecast/warning fixture data sets (08_...md §2)
   /tests/                 # integration tests (10_...md §3)
/cache/              # caching/fallback layer (06_...md)
/backend/            # API layer — /homepage, /explain, /preferences (07_...md)
   /tests/              # contract tests
/frontend/           # S1–S5 screens (09_ux_ui_specification.md)
/eval/               # golden dataset (05_...md), spike runner (04_...md)
/docs/               # this entire document set — kept as the source of truth, not duplicated into code comments
```

Rationale: `/engine` having zero dependencies on `/adapters`, `/backend`, or `/frontend` is the single most important structural rule — it is what makes the engine unit-testable and independently buildable in parallel with data integration (see §3 below), and is a direct implementation of the module-boundary rule in `06_...md` §2.

## 2. Branch/Workflow Guidance for a 6-Member Team
- `main` — always demoable (even if feature-incomplete; never broken).
- `dev` — integration branch; merge target for all feature branches.
- Feature branches per module: `engine/*`, `adapters/*`, `backend/*`, `frontend/*`, `eval/*` — matching the repo structure above, so ownership and merge conflicts stay predictable.
- **Merge rule:** nothing merges into `dev` without its module's tests passing (engine unit tests, adapter integration tests, or contract tests as applicable) — this is cheap to enforce with 6 people and prevents the "looked fine on my machine" failure mode common in hackathon codebases.
- Daily short sync (15 min) focused on one question: "did anything cross a module boundary today that needs a contract update in `07_api_and_data_contracts.md`?" — contract drift between frontend/backend/engine is the most likely late-stage integration failure in a fast build.

## 3. Environment Setup
- API credentials (data.gov.in, aqicn.org, OpenWeatherMap) live in a local `.env`, never committed — see `HUMAN_RESEARCH_AND_ACCESS_CHECKLIST.md` for who registers what.
- `/adapters/fixtures` (simulated IMD data) is checked into the repo directly — no credentials needed to run `/engine` or `/adapters` tests, so any team member can develop against them without waiting on API registration (this directly de-risks the registration-delay dependency flagged in `08_...md` §5/§6).

## 4. Local Development
- `/engine` and `/eval` can be developed and fully tested with zero network access, zero credentials, from day 1 — this should be the first thing built (see §6 execution order below), because it's the part every other module depends on and the part least blocked by anything external.
- `/adapters` for AQI/UV need real credentials to test the live path, but can be developed against recorded sample responses (capture one real response from each API early, save as a fixture, and use it for adapter unit tests — don't require a live call for every test run).
- `/backend` and `/frontend` can be developed against a stub engine/adapter layer (fixed sample `ContextFrame`/`RankedCards` payloads matching `07_...md` schemas) before the real engine is finished — this is how engine and UI work happen in parallel without blocking each other.

## 5. Deployment / Demo Setup

> **UPDATED — see `16_production_architecture_reassessment.md` for the authoritative stack.** The concrete decision is: **Vercel** (frontend) → **Render** (backend) → **Neon** (serverless Postgres, persistent preferences/cache). The "any simple host" guidance below remains correct in spirit; this note adds the specific choice and its implications.

- The deployed stack is **Vercel + Render (free tier) + Neon (free tier)** — zero cost for a hackathon demo and zero-config deploys from a git push.
- Preferences and signal-cache data **persist across Render restarts and redeploys** (stored in Neon, not on Render's ephemeral disk) — no mid-demo data resets.
- Demo location(s) should be decided in advance and their live AQI/UV values fetched and cached the night before, so demo-day is not dependent on live network conditions at the venue (`08_...md` §5 contingency, operationalized here).
- Keep a **local-only fallback build** (all adapters forced to cached/simulated mode, no network calls at all) as the literal last-resort demo path if venue connectivity fails entirely — test this once, don't assume it works.
- **Pre-demo warm-up:** hit `GET /health` on the deployed Render URL 10–15 min before going on stage to wake the free-tier instance from cold-start (see `16_production_architecture_reassessment.md` §4.3).

## 6. Recommended Build Order (maps to parallelizable work, not individual assignment)
1. `engine` core (scoring, priority, conflict resolution) + its unit tests — no dependencies, start immediately.
2. `adapters/sun_adapter` (local calc) + `adapters/forecast_adapter`/`warning_adapter` (fixtures) — no credentials needed, start immediately, in parallel with (1).
3. `07_...md` contract finalized between backend/frontend owners — needed before both can build against a shared shape; do this early, in parallel with (1)/(2).
4. `adapters/aqi_adapter` + `uv_adapter` against real APIs — start as soon as credentials are registered (see checklist); can begin with recorded sample fixtures before credentials arrive.
5. `backend` wiring engine + adapters + cache behind the `07_...md` contract.
6. `frontend` S1–S5 — can start against stub payloads in parallel with (5), integrate once (5) is live.
7. Run the feasibility spike (`04_...md`) as soon as (1)+(2) exist — does not require (4)/(5)/(6) to be finished.
8. Full integration + demo-day checklist (`10_...md` §6) once (5)+(6) are stable.

## 7. Backup/Fallback Plan If APIs Fail
Already specified functionally in `07_...md` §4 (degraded-data response contract) and `08_...md` §5 (contingency table). Operational summary: nothing in this system throws an unhandled error when a live API is unavailable — everything degrades to cache, then to a labelled `unavailable` state, and the offline/local-only build (§5 above) is the full-system last resort. This should be treated as a rehearsed part of the demo, not a hidden safety net (see `12_demo_and_judging_narrative.md`).
