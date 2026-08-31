# 06 — System Architecture

Builds directly on `00_project_decision_log.md` (D1–D5) and `03_personalization_logic_and_decision_matrix.md`. No change to the central thesis; this file makes it buildable.

## 1. Module Map

```
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND (mobile-shaped web/app UI)                              │
│  - Homepage (ranked cards)                                        │
│  - Explanation sheet ("Why am I seeing this?")                    │
│  - Preferences/persona editor                                     │
│  - Onboarding / cold-start view                                   │
│  - Degraded/offline/error states                                  │
└───────────────────────────┬────────────────────────────────────--┘
                             │ REST/JSON (see 07_api_and_data_contracts.md)
┌───────────────────────────▼──────────────────────────────────────┐
│  BACKEND API LAYER                                                │
│  - /homepage, /explain, /preferences endpoints                    │
│  - Auth-free for MVP (device/session id only, no login required)  │
└───────────────────────────┬──────────────────────────────────────┘
                             │
┌───────────────────────────▼──────────────────────────────────────┐
│  PERSONALIZATION ENGINE (pure logic, no I/O)                      │
│  - ContextFrame builder                                           │
│  - Scoring function (persona_weight × urgency × confidence)       │
│  - Priority classifier (P0–P3) + hard-rule overrides              │
│  - Conflict resolver                                              │
│  - Explanation generator (templated from scoring components)      │
│  Input: ContextFrame  →  Output: RankedCards[] + Explanations[]   │
└───────────────────────────┬──────────────────────────────────────┘
                             │ reads
┌───────────────────────────▼──────────────────────────────────────┐
│  DATA ADAPTER LAYER (one adapter per source, common interface)    │
│  - AQIAdapter (CPCB/data.gov.in, aqicn.org fallback)               │
│  - UVAdapter (OpenWeatherMap)                                     │
│  - SunAdapter (local astronomy calc — no network)                 │
│  - ForecastAdapter (simulated, IMD-bulletin-shaped fixtures)       │
│  - WarningAdapter (simulated, IMD-shaped)                          │
│  Each adapter returns: { value, source, freshness, confidence }   │
└───────────────────────────┬──────────────────────────────────────┘
                             │
┌───────────────────────────▼──────────────────────────────────────┐
│  CACHING / FALLBACK LAYER                                         │
│  - Last-known-good cache per signal, per location                 │
│  - Staleness threshold checker                                    │
│  - Serves cached value + "stale" flag when live fetch fails        │
└───────────────────────────┬──────────────────────────────────────┘
                             │
┌───────────────────────────▼──────────────────────────────────────┐
│  STORAGE                                                           │
│  - User preferences (persona, health flags, saved locations)       │
│  - Signal cache (last-known-good per signal/location/timestamp)   │
│  - Golden evaluation set (for spike/testing, not runtime)          │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Module Boundaries (hard rules)

- The **Personalization Engine has no network/database calls.** It is a pure function: `ContextFrame → (RankedCards, Explanations)`. This is what makes it unit-testable per `10_testing_and_validation_plan.md` and keeps Risk R5/R6 (engine degenerating into a lookup table, explanations decoupled from ranking) structurally hard to introduce by accident.
- **Data adapters never talk to each other or to the engine's scoring logic.** Each adapter's only contract is: given a location/time, return a signal value + metadata, or raise a defined "unavailable" result. The engine does not know or care whether a value came from a live API or a simulator — it only reads `confidence`.
- **The caching/fallback layer sits between adapters and the engine**, not inside either. This is what implements PRD NFR-2/NFR-4 and the missing-data handling in `03_...md` §10 without polluting engine logic with retry/network concerns.
- **The frontend never computes ranking.** It renders whatever the backend returns. This keeps the explanation-traceability guarantee (NFR-1) enforceable in one place.

## 3. Data Flow (single homepage render)

1. Frontend sends `GET /homepage?location=&persona=&health_flags=` (or cold-start defaults if no preferences set).
2. Backend builds a `ContextFrame`: calls each data adapter → each adapter tries live fetch → on failure, caching layer supplies last-known-good + `stale=true`, or `unavailable=true` if nothing cached.
3. Backend passes the completed `ContextFrame` to the Personalization Engine.
4. Engine returns `RankedCards[]` (each with priority, score components, explanation) — see contract in `07_api_and_data_contracts.md`.
5. Backend responds to frontend; frontend renders cards in priority order, badges any `stale`/`simulated` cards, and renders P0 warnings above the ranked list with a visual break.

## 4. Real / Simulated / Stale / Missing — Handling Summary

| State | Where decided | What the engine sees | What the UI shows |
|---|---|---|---|
| Real, fresh | Adapter + cache layer | `confidence≈1.0, source="live"` | Normal card, small "live" source badge |
| Real, but cache-served (fetch failed, cache within threshold) | Cache layer | `confidence≈0.9, source="cached"` | Normal card, "as of [time]" badge |
| Simulated (IMD forecast/warnings in MVP) | Adapter (returns fixture, labelled) | `confidence≈0.7, source="simulated"` | Card renders normally but with a persistent "simulated for demo" badge — never hidden |
| Stale (beyond freshness threshold) | Cache layer | `confidence≈0.3, source="stale"` | Card sinks in rank naturally (per scoring) AND shows an explicit "last known, may be outdated" badge |
| Missing entirely | Adapter returns `unavailable` | Engine either omits the card or substitutes a safe generic default (per `03_...md` §10) | Card omitted, or shown as "estimate unavailable" placeholder — never a fabricated live-looking number |

This table is the binding implementation reference for Flag 7/8 in `00_consistency_check_and_flags.md` — the confidence values above are the same illustrative placeholders flagged there as needing spike-time sanity-checking, not final tuned constants.

## 5. Suitability for 1–2 Week MVP, With an Upgrade Path

- **MVP-buildable:** the engine is a small, dependency-free scoring/ranking function; adapters are thin wrappers (2 real API calls + 1 local calc + 2 fixture readers); caching layer can be an in-memory or lightweight key-value store, not a distributed system.
- **Upgradeable later (per D1/D5):** because the engine's contract is `ContextFrame → RankedCards`, a future learned ranking model can be substituted or blended behind the same contract without touching adapters or frontend. A real IMD API adapter can replace the simulated one by implementing the same adapter interface — no engine change required.

## 6. Non-Functional Constraints Carried Over From PRD
NFR-1 (traceable explanations), NFR-2 (works without live IMD access), NFR-3 (re-computed on context change, not cached-forever at the ranking level — only signal values are cached, never the ranked output), NFR-4 (visible source/freshness per card) are all satisfied structurally by the module boundaries above, not bolted on afterward.
