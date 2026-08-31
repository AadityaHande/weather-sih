# Mausam — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | Mausam — Personalized Homepage Engine for the IMD "Mausam" mobile app |
| **Competition / Context** | SIH 2026 · Problem Statement **SIH26076** · Ministry of Earth Sciences / India Meteorological Department · Theme: Smart Automation |
| **Version** | 1.0 |
| **Status** | Draft — aligned with current build (2026-08-31) |
| **Owner** | Product / Frontend team |
| **Related docs** | [frontend_product_spec.md](frontend_product_spec.md) · [ui_screen_specification.md](ui_screen_specification.md) · [`docs/planning/`](planning/) · [project_status.md](project_status.md) |

---

## 1. Executive Summary

Every weather app shows every user the same dashboard. A parent planning a school commute, a runner planning a morning workout, and an asthmatic checking air quality need *different* information from the *same* weather. **Mausam** is a contextual personalization layer for the official IMD Mausam app: it ingests live weather/environment signals (temperature, rain probability, AQI, UV, wind, severe-warning feeds), applies a deterministic scoring engine tuned to each user's declared persona and health flags, and returns a **ranked, explainable homepage** — plus a full weather dashboard and an interactive weather map.

It is **not** a replacement weather app. It is the intelligence that decides *what appears at the top of a weather homepage, and why*, for a given user at a given moment.

**Value proposition:** same weather, genuinely different homepages — with every ranking decision traceable to a real signal value.

---

## 2. Problem & Opportunity

### 2.1 Problem
- The official Mausam app shows a generic, identical homepage to all users.
- Critical, user-specific signals (AQI for respiratory users, UV for outdoor fitness, rain-in-commute-window for parents) are buried or missing.
- Users must manually hunt for the one number that matters to them.

### 2.2 Opportunity
- India has 22 scheduled languages and extreme variation in weather-relevant behaviour — a one-size homepage under-serves everyone.
- A lightweight, explainable ranking layer (no LLM hallucination, deterministic rules) can be built on top of existing IMD/MoES data and integrated into the existing app.
- SIH context gives a clear, judging-friendly narrative: personalization + explainability + safety-first warnings.

### 2.3 Goal statement
> Given this user's persona and the current environment, the first card they see on the Mausam homepage is the single most important thing they should know right now — and they can see exactly why it was ranked first.

---

## 3. Vision, Goals, Non-Goals

### 3.1 Vision
Every Mausam user opens the app and immediately sees the weather information that matters most to *them*, in their language, with an honest explanation of why it's shown first.

### 3.2 Product Goals (SMART)
| # | Goal | Measure | Target |
|---|---|---|---|
| G1 | Homepage relevance | Users identify the top card as "most relevant" in usability tests | ≥ 80% |
| G2 | Explainability | % of ranked cards with a rendered, deterministic explanation | 100% |
| G3 | Safety | Severe-warning cards always break to the top (P0) | 100% of warning events |
| G4 | Performance | Time-to-interactive on 3G-class connection | ≤ 4s p95 |
| G5 | Coverage | Number of supported personas & languages | 4 personas · 22 languages (en + 21) |

### 3.3 Non-Goals (explicitly out of scope for v1.0)
- Building a new weather-data source or forecast engine (we consume existing providers/IMD feeds).
- Re-ranking on the client (the backend owns ranking; the UI is a faithful renderer).
- Non-deterministic / AI-generated explanations.
- Replacing the full IMD Mausam app or its official API surface.
- Deferred personas (see §5.2) requiring unavailable data sources.

---

## 4. Market & Competitive Context

| App | Strength | Gap Mausam exploits |
|---|---|---|
| AccuWeather / Weather.com | Rich global data | Generic homepage; no persona-aware ranking; ad-driven |
| IMD Mausam (official) | Authoritative MoES data | Same homepage for everyone; limited personalization & explanation |
| Windy | Excellent map/overlays | Enthusiast tool, not personalization |
| Umang / MyGov weather surfaces | Official aggregations | No explainable, persona-ranked homepage |

**Mausam's wedge:** it doesn't compete on *more data* — it competes on *relevance + explanation*. For a government-brokered app, trust ("why am I seeing this?") is the differentiator.

---

## 5. Users & Personas

### 5.1 Implemented personas (P0 in current build)
| Persona | Focus signals | Typical top card |
|---|---|---|
| Health-conscious | AQI, UV, humidity (+ respiratory flag) | `aqi_health` alert at high AQI |
| Outdoor fitness | Daylight, UV, heat, activity windows | `activity_window` / `uv_sun_exposure` |
| Parents & families | Rain-in-commute-window, severe warnings | `rain_commute` / P0 `severe_warning` |
| Default / cold-start | Severe warning > general > AQI | `severe_warning` first |

### 5.2 Deferred personas (data-gated; documented in `docs/planning/00_project_decision_log.md` D4)
Beachgoers/marine (INCOIS API), Travelers (multi-destination routing), Agriculture (agromet data), Commuters-with-traffic (external traffic API), Event planners (comfort index).

### 5.3 No-signup device identity
Users are anonymous by default; a locally generated `device_id` scopes their persona + preferences. Optional auth is an enhancement (§9.6).

---

## 6. Product Principles (Invariant)

1. **No client re-ranking.** The frontend renders the backend's sorted order, verbatim.
2. **Always explainable.** Every personalized card traces to real signal values (`/explain`).
3. **Safety first.** Severe-weather warnings bypass persona weights and become P0.
4. **Honest data.** Simulated / cached / unavailable data is explicitly badged (`source: "unavailable"` → UI badge).
5. **Deterministic.** Identical inputs produce identical rankings and explanations.
6. **Localized.** 22 scheduled languages + English; RTL support; locale-aware formatting.

---

## 7. Information Architecture

```
Mausam
├── Home Feed (S1/S2)      — ranked, explained personalized cards
├── Weather Dashboard      — full forecast for the active location
├── Interactive Map        — basemap styles, weather overlays, radar loop, GPS
├── Explanation Sheet      — "why was this ranked first?" per card
├── Preferences/Onboarding — persona, health flags, language
├── Auth / Settings        — device identity, theme, units
└── AI Chatbot             — natural-language weather queries (opt-in)
```

---

## 8. Functional Requirements

Priorities: **P0** (must, v1.0) · **P1** (should, v1.x) · **P2** (nice-to-have).

### 8.1 Personalized Home Feed — P0

**User story:** *As a health-conscious user on a high-AQI day, I want the AQI alert at the top so I can decide whether to run outdoors — without scrolling.*

**Requirement H1 — Ranked cards.** Render the backend's `/homepage` order strictly (no client reordering).

**Requirement H2 — Explainability.** Every card has a tap-to-reveal explanation showing the exact signal values and the score that drove its rank.

**Requirement H3 — P0 severe warnings.** When the backend returns a P0 warning card, it is pinned first, visually distinct, and never buried.

**Acceptance criteria (H1–H3):**
- AC-H1: Rendering an array of N cards in reverse API order produces reverse visual order (property test).
- AC-H2: 100% of personalized cards render an explanation sheet populated from `/explain` response fields.
- AC-H3: Given a fixture with an active severe warning, the warning card is the first element and styled as an alert.

**Requirement H4 — Honest data badges.** Cards sourced from cached/simulated data display a freshness/source badge and never claim to be "Live".

### 8.2 Weather Dashboard — P0

**User story:** *As any user, I want a complete current + hourly + daily forecast for my location so I can plan my day.*

- Current conditions (temp, feels-like, humidity, wind, pressure, AQI, UV).
- 24h / hourly strip (aligned to the current hour, not midnight).
- Multi-day daily forecast.
- Pull-to-refresh gesture (mobile-first) and refresh controls on desktop.
- Location search + GPS auto-detect with honest fallback to a default city when permission is denied.

**Acceptance:** AC-D1 current/hourly/daily render from `fetchHomepage`/weather payloads; AC-D2 pull-to-refresh triggers a refetch and shows a spinner until resolve; AC-D3 permission-denied state shows a clear fallback notice, not a silent failure.

### 8.3 Interactive Weather Map — P0 (enhanced in this pass)

**User story:** *As a traveler, I want to tap any point on the map and see its live weather, and watch radar move over the last hour, so I can plan a route.*

**Requirement M1 — Basemaps & correct zoom limits.** Multiple basemap styles (Detailed, Clean Light, Minimal Light, Dark, Satellite). Each style's maximum zoom is **clamped to the tile provider's real ceiling** (Esri Canvas light/dark = z16, OSM = z19, Satellite = z19) so users never see the provider's "zoom level not supported" placeholder tiles.

**Requirement M2 — Weather overlays.** Selectable overlays: Rain Radar (animated), Temperature, Wind Flow, Cloud Cover, Atmospheric Pressure, or "Map Only". Each shows a matching color legend/scale.

**Requirement M3 — Radar timeline.** Radar loop supports play/pause and scrubbing across past frames with a per-frame timestamp; frame updates swap the tile URL in place (no layer flicker).

**Requirement M4 — Point inspection.** Tapping the map drops a pin, reverse-geocodes the exact locality, and shows live temp/feels/condition, rain %, wind, UV and AQI in a summary card. Lookups are debounced.

**Requirement M5 — GPS.** "Locate Me" gets high-accuracy position, flies to it, draws an accuracy halo, and offers a "recenter" control; a GPS-active chip reflects state.

**Requirement M6 — Theme coherence.** `streets` ↔ `dark` basemaps auto-follow the app theme; an explicit user choice (satellite/voyager/light) is **preserved** and persisted (`mausam_map_style`).

**Requirement M7 — Mobile + search.** Search (locality/city/coordinates) is available on all breakpoints; quick-jump city pills; zoom in/out controls and a live zoom-level chip.

**Requirement M8 — Resilience.** Offline/stale state shows the app's `OfflineBanner`; loading shows a skeleton card; missing tiles are silently absorbed.

**Acceptance criteria (M1–M8):**
- AC-M1: Zooming to z≥17 on Light/Dark styles yields real tiles (no provider placeholder); switching to a style while zoomed past its ceiling clamps the zoom.
- AC-M2–M3: Selecting each overlay renders tiles + legend; radar play advances frames at ~700 ms with a correct timestamp and no layer rebuild.
- AC-M4–M5: Tap → pin + locality + live summary; Locate → accuracy halo + recenter control appears.
- AC-M6: Toggling theme flips streets↔dark only; satellite selection survives a theme toggle and a reload.
- AC-M8: With the network disabled, the banner appears and cached/empty states render gracefully.

### 8.4 Explanation Sheet — P0

**User story:** *As a skeptical user, I want to see why a card was ranked first so I trust the app.*

- Bottom-sheet/drawer per card showing `card_id`, contributing signals, weights, computed score, and threshold used.
- Deterministic, human-readable phrasing (no AI).

**AC-E1:** Every personalized card opens an explanation sheet; AC-E2: explanation values match the `/explain` API response exactly.

### 8.5 Preferences / Onboarding — P0

**User story:** *As a first-time user, I want a quick setup where I pick who I am and any health flags so my homepage is personalized from the first launch.*

- Device-scoped: persona selection, optional health flags (asthma/respiratory, sensitivity), language selection (22 languages).
- Saved to the backend (`/preferences`) and reused across sessions via `device_id`.
- Honest fallback when preferences are unset (cold-start persona).

**AC-P1:** Setting persona + flags + language persists and immediately changes the returned `/homepage` ranking; AC-P2: an unset user receives the cold-start ranking.

### 8.6 Auth & Device Identity — P0

- Anonymous `device_id` generated locally on first launch; stored in localStorage.
- Optional email/phone auth as an enhancement (P1) to enable cross-device sync.

**AC-A1:** Homepage works with zero auth friction; preferences are scoped to the device.

### 8.7 AI Chatbot — P1

**User story:** *As a user, I want to ask "when should I leave to avoid rain?" in my language and get a concise, data-grounded answer.*

- NL query → structured weather context → concise answer; voice input on supporting browsers; language-aware (SPEECH_LANG_MAP); degraded to English gracefully.
- Backend `/api/chat` with locale + persona context; honest "I don't know" for unsupported queries.

**AC-C1:** A query about rain-in-commute-window returns the relevant rain-probability window; AC-C2: unsupported/offline queries return a graceful fallback, never a hallucinated forecast.

### 8.8 i18n & Localization — P0 (cross-cutting)

- 22 scheduled languages + English (`en` default). `t(key)` with silent English fallback; nested dictionaries statically imported for zero-latency rendering.
- RTL layout for Urdu etc.; locale-aware number/date/time formatting; localized place names.
- Language persisted (`mausam_locale`); applied to `<html lang/dir>`.

**AC-I1:** Switching language re-renders all screens with translated copy and correct `dir`; missing keys fall back to English, never raw keys.

### 8.9 PWA / Offline — P1

- Installable PWA (`manifest.json`), service-worker registration, cached last payload, honest "you're offline, showing last update" banner (`OfflineBanner`).
- Capacitor Android packaging exists.

**AC-W1:** Reloading the app offline shows the last successful payload + banner; AC-W2: installing the PWA presents an app-like experience.

---

## 9. UX / UI Requirements

- **Design language:** iOS-style — `ios-*` color/label tokens, inset grouped cards, squircle radii, `--ease-ios` motion, safe-area handling. Dark mode via `.dark` on `<html>`, theme persisted and applied pre-hydration (no flash).
- **Responsive:** mobile-first (the primary form factor + Capacitor Android), with desktop refinements (wider panels, hover affordances).
- **Accessibility (WCAG 2.1 AA):** icon buttons carry `aria-label`, toggle buttons `aria-pressed`, the map is a `region` with a label, touch targets ≥ 44 px, visible focus, reduced-motion respect for the pull-to-refresh and radar loop.
- **States:** loading skeletons, empty states, offline banner, and recoverable error screens (Next.js `error.tsx`/`global-error.tsx`).
- **Honest freshness:** source/freshness badges on every data-driven card.

---

## 10. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | TTI ≤ 4s p95 on 3G-class; map first tile paint ≤ 2s; radar loop frame swap ≤ 300 ms; no layout shift on homepage hydration |
| Reliability | Graceful degradation to cached/fixture data; tile errors silently absorbed; reverse-geocode + weather fetch failures never crash the screen |
| Security | No secrets in client bundle (OWM key server-side, proxied via `/api/weather-tile`); rate-limited backend; sanitized API error surfaces |
| Privacy | Anonymous `device_id`; preferences stored with the ID; no PII required; transparent about simulated data |
| Scale | Backend cache + stale-before-fixture fallback; in-memory rate-limit adequate for single worker; shared store (Redis) before horizontal scaling |
| Maintainability | Engine isolated from framework/network (`check_boundaries.py`); frontend components extracted under `components/`; typed shared libs (`lib/mapData.ts`, `lib/leaflet.ts`) |
| Testing | Backend/engine 149 tests (CI-gated); **frontend tests still open** (see §14 O1) |

---

## 11. Analytics & KPIs

| KPI | Definition | Target |
|---|---|---|
| Top-card relevance | % of users who agree the top card is most relevant (survey) | ≥ 80% |
| Explanation open rate | % of personalized card taps that open the sheet | ≥ 40% |
| Warning prominence | % of warning events where the P0 card was first | 100% |
| Map interaction depth | % of map sessions that change layer/style or inspect a point | ≥ 50% |
| Language coverage | % of sessions in a non-English locale | ↑ |
| Crash-free sessions | % sessions with no uncaught error | ≥ 99.5% |

---

## 12. Dependencies & Constraints

- **IMD/MoES data:** severe-warning feed (live `WarningAdapter` is **open** — see §14), AQI (CPCB fixture + live adapter scaffold), UV, forecast.
- **Third-party:** Open-Meteo (forecast/AQI), OpenStreetMap Nominatim (geocode), RainViewer (radar tiles), Esri ArcGIS (basemaps), OpenWeatherMap tiles (overlay — proxied server-side).
- **Platform:** Next.js 16 App Router (Turbopack), React, Leaflet, TanStack Query, PostgreSQL (Neon-compatible), Python/FastAPI backend, Render deploy.
- **NFR constraints:** public APIs rate-limit (Nominatim), so map lookups are debounced; tile providers cap zoom (handled in §8.3 M1).

---

## 13. Release Milestones

| Milestone | Scope | Status |
|---|---|---|
| M0 — Architecture baseline | Repo, engine contract, API contract, planning docs | ✅ |
| M1 — Phase 2A | Backend + Postgres preferences | ✅ |
| M2 — Phase 2B | Fixture adapters + personalized homepage API + full frontend | ✅ |
| M3 — Production hardening | Caching, rate limiting, error boundaries, CI, live adapters | ✅ |
| M4 — Map enhancement + product docs | Zoom-limit fix, map UX/UI polish, this PRD | 🔄 In progress |
| M5 — Hardening gaps | API auth, shared rate-limit/cache, frontend test suite, live WarningAdapter, SunAdapter TZ | 🔲 Next |

---

## 14. Open Questions & Assumptions

| ID | Item | Assumption / Ask |
|---|---|---|
| O1 | Frontend test suite | No frontend tests today; recommend adding component tests for Home Feed, Weather, Map (Plan: Vitest + Testing Library) |
| O2 | `WarningAdapter` live mode | Blocked on IMD warning-feed API access; fixture-only today (P0 safety gap) |
| O3 | API authentication | `/homepage`, `/preferences` are open; needs scoping before public deployment |
| O4 | `SunAdapter` timezone | Hardcoded `Asia/Kolkata`; non-India preset cities would be wrong — derive TZ from lat/lon |
| O5 | Map deep-zoom ceiling | Satellite capped at z19 for consistency (server supports z23) — confirm acceptable |
| O6 | Preferences syncing | Optional auth (P1) to enable cross-device persona sync — confirm priority |

---

## 15. Appendix — Related Documents

- [`docs/frontend_product_spec.md`](frontend_product_spec.md) — frontend-focused product spec & journeys.
- [`docs/ui_screen_specification.md`](ui_screen_specification.md) — screen inventory (S1–S5).
- [`docs/project_status.md`](project_status.md) — current build status & gaps.
- [`docs/planning/09_ux_ui_specification.md`](planning/09_ux_ui_specification.md) — UX/UI spec.
- [`docs/planning/13_final_mvp_specification.md`](planning/13_final_mvp_specification.md) — final MVP spec.
- [`docs/planning/03_personalization_logic_and_decision_matrix.md`](planning/03_personalization_logic_and_decision_matrix.md) — scoring decision matrix.
- [`docs/planning/07_api_and_data_contracts.md`](planning/07_api_and_data_contracts.md) — API contracts.
