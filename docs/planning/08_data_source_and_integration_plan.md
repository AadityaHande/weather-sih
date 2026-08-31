# 08 — Data Source and Integration Plan

Consolidates and operationalizes the data findings already established in `SIH26076_Deep_Research_Dossier.md` §3 and `13_final_mvp_specification.md`'s data table. Does not re-litigate the research — this is the integration execution plan.

## 1. Exact Data Needed for MVP (per the 3 locked personas)

| Signal | Needed for | MVP integration |
|---|---|---|
| AQI | Health persona (primary), Fitness (secondary) | **Live** |
| UV Index | Health, Fitness | **Live** |
| Sunrise/Sunset | Fitness (activity window), general | **Live (computed, no API)** |
| Current temp/humidity/wind | All personas, general card | Simulated fixture (IMD-shaped) |
| Precip probability / rain forecast | Family (primary), Fitness | Simulated fixture (IMD-shaped) |
| Severe warnings | All (P0 override) | Simulated fixture (IMD-shaped), scriptable for demo |
| Pollen | Health (optional, if included) | Simulated/illustrative, clearly flagged — not alertable |

## 2. Source Priority and Fallback Hierarchy

**AQI:** 1) data.gov.in CPCB resource (primary, official) → 2) aqicn.org API (secondary, same underlying CPCB station network, lower registration friction) → 3) last-known-good cache → 4) `unavailable` state (per `07_...md` §4).

**UV:** 1) OpenWeatherMap One Call 3.0 (primary) → 2) last-known-good cache → 3) `unavailable` state. (No secondary live provider identified in research; if OpenWeatherMap's free tier proves insufficient, this is a Flag-5-class blocker — see `00_consistency_check_and_flags.md`.)

**Sunrise/Sunset:** computed locally via standard astronomical formulas (lat/lon/date) — no external dependency, no fallback needed, cannot fail due to network/quota.

**Forecast/rain/warnings (simulated):** fixture files shaped exactly like real IMD API response fields (per the field list in the dossier's IMD API section) — so the adapter interface is identical to what a real IMD adapter would implement. No fallback needed since it's local data, but fixtures must include at least: a "normal day," a "rain/commute-impact day," a "heat/UV-spike day," and a "severe warning day" so every demo scenario in `12_demo_and_judging_narrative.md` has backing data.

## 3. What Can Realistically Be Integrated Now vs. Mocked

| Realistically live now | Mocked/simulated for MVP |
|---|---|
| CPCB AQI (via data.gov.in or aqicn.org) | IMD forecast |
| OpenWeatherMap UV | IMD rain probability |
| Computed sunrise/sunset | IMD severe warnings |
| — | INCOIS marine/tide (excluded from MVP entirely) |
| — | Pollen (illustrative only if shown) |
| — | Soil moisture/agromet (excluded from MVP) |

## 4. Verified-Live vs. Simulated — Non-Negotiable UI Separation

Per `06_system_architecture.md` §4 and `07_...md` §4: every card must carry its `source` field through to the UI as a visible badge. **No engineering shortcut may merge a simulated value into a "live"-labelled card.** This is a demo-credibility requirement (Flag 4/6 in the audit), not just a nice-to-have.

## 5. API Access Risks and Contingency Plan

| Risk | Contingency |
|---|---|
| data.gov.in CPCB registration is slow/blocked | Fall back immediately to aqicn.org token (register both in parallel from day 1, don't wait to find out one is slow) |
| OpenWeatherMap free tier rate limit hit during testing/demo | Cache aggressively (per-location, e.g. 15–30 min TTL); pre-fetch and cache the exact demo location(s) the night before demo day |
| Any live API is down/unreachable on demo day (venue wifi, provider outage) | Full offline demo fallback: a pre-captured last-known-good snapshot per demo location, loaded into the cache layer before presenting — this doubles as the "graceful degradation" demo beat (see `12_...md`), so it is not purely a safety net, it's rehearsed |
| IMD API whitelisting request (filed per `00_assumptions_and_open_questions.md`) is not resolved before demo day | Expected outcome, not a risk to react to — simulated adapter is the MVP path by design (D3 in decision log), not a contingency |

## 6. Integration Order (execution sequence, not team assignment)

1. Register data.gov.in + aqicn.org + OpenWeatherMap credentials (day 1 — see `HUMAN_RESEARCH_AND_ACCESS_CHECKLIST.md`).
2. Build AQIAdapter and UVAdapter against real APIs, confirm field mapping into the `environment.aqi` / `environment.uv` schema (§1 of `07_...md`).
3. Build SunAdapter (local calc) — no external dependency, can be done in parallel with step 2.
4. Build ForecastAdapter/WarningAdapter against fixture files shaped to the real IMD API's documented field names (so a future real-IMD swap is a drop-in).
5. Wire caching/fallback layer around all adapters uniformly (same interface regardless of live vs. simulated).
6. Only once steps 1–5 are stable: connect to the Personalization Engine (`03_...md`) for scoring/ranking.

This order exists so that a data-registration delay (the most likely real risk, per Flag 5) is discovered on day 1, not day 5, while there is still time to react.

## 7. Production Hardening (Adapter-Level)

> **See `16_production_architecture_reassessment.md` §3 for the definitive treatment.** This section summarises only the integration-plan-relevant consequences.

For the deployed backend (Render → Neon), each adapter that makes a live network call (`AQIAdapter`, `UVAdapter`) must enforce:

- **Connection timeout:** 5 s — prevents a hung external API from blocking the request thread.
- **Read timeout:** 10 s — gives the response time to arrive while still being bounded.
- **Retry:** 1 retry on transient `TimeoutError` / 5xx, with a 0.5 s back-off — enough to handle a momentary hiccup without making the caller wait excessively.
- **Fallback on exhaustion:** proceed to the next entry in the source priority hierarchy (§2 above) — never raise an uncaught exception to the backend.

These constraints are adapter-internal; the engine never sees them and the contract from `07_...md` is unchanged. The `signal_cache` table (Neon, not SQLite in production) is where last-known-good values land after a successful live fetch, so a subsequent adapter failure gracefully degrades to `source: "cached"` rather than `source: "unavailable"` as long as a prior fetch has succeeded.
