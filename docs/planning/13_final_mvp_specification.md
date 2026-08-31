# 13 — Final MVP Specification (Team Source of Truth)

## One-line definition
A Mausam homepage that ranks and explains what weather/environmental information matters right now, for this user and context, using a transparent rule+scoring engine — not a persona switch, not an LLM guess.

## Central Innovation
A contextual relevance & priority engine that (1) scores candidate homepage cards from real and simulated environmental signals, (2) explains every ranking in terms of the actual signal values that drove it, (3) has defined, demoable behaviour for cold-start users and for missing/stale data — properties not found together in reviewed academic, open-source, or commercial prior art (see `02_novelty_and_competitive_landscape.md`).

## User Journey (MVP)
1. First open, no profile → sees a sensible default-safety-first homepage immediately (cold-start path).
2. User optionally sets persona + health flags in a lightweight preference screen.
3. Homepage re-ranks live: cards reorder, alerts appear/disappear, each card is tappable to reveal its explanation.
4. If a signal is unavailable, affected card shows a "last known / simulated" badge instead of breaking.
5. If a severe warning is present, it always appears first, with a clear visual break from the ranked list below it.

## Exact Features (MVP)
- Contextual Relevance Engine (rules + weighted scoring, per `03_...md`).
- 3 built personas: Health-conscious, Fitness/Commuter, Family/Parent.
- Real CPCB AQI integration (data.gov.in or aqicn.org).
- Real/global UV index integration (OpenWeatherMap One Call).
- Locally computed sunrise/sunset (no external dependency).
- Simulated, IMD-bulletin-shaped forecast/rain/warning data, clearly labelled, behind a swappable adapter interface.
- Explanation layer (tap-to-reveal "why this is shown," templated from scoring components).
- Cold-start default profile and behaviour.
- Missing/stale-data fallback UI states.
- Demoable P0 override (severe warning forces top rank).

## Exact Personalization Behaviour
As specified in `03_personalization_logic_and_decision_matrix.md` §1–13, including the two worked example scenarios there. This file is binding — implementation should not silently diverge from it; if it must change, update the decision log (`00_project_decision_log.md`) and this file together.

## Data Sources: Real vs. Simulated
| Source | Status | Notes |
|---|---|---|
| CPCB AQI | Real, live | Register both data.gov.in and aqicn.org paths |
| UV Index | Real, live (global provider) | OpenWeatherMap One Call 3.0, free tier |
| Sunrise/Sunset | Real, computed locally | No API dependency, no failure mode |
| IMD forecast/rain/warnings | Simulated, IMD-shaped | Behind adapter; swappable if whitelisting is later granted |
| Marine/tide (INCOIS) | Excluded from MVP | Should-have narrative only |
| Pollen | Simulated/illustrative if shown at all, clearly flagged | Known unvalidated-for-India limitation |
| Soil moisture / agromet | Excluded from MVP | Final-round item |

## Fallback / Degraded Behaviour
See `03_...md` §10–12. In one line: never fabricate a live-looking number; never crash or blank; always disclose degraded state visibly.

## Demo Acceptance Criteria
1. Same simulated weather state, two different personas selected live → visibly different card order and different explanations.
2. Same persona, time/context advanced (or a warning injected) → visibly different priority without changing persona.
3. Fresh app state (no profile) → sensible non-empty homepage, zero configuration.
4. One data feed intentionally disabled during the demo → visible, graceful degraded state, not a crash.
5. Tap any P1/P0 card → explanation references the actual real/simulated signal value shown elsewhere on the same card.

## Explicit Out-of-Scope Items
Beachgoer/marine, agriculture, event-planner, traveler-full-build personas; real IMD API integration; ML/learned ranking; multilingual full localization (English + partial Hindi labels only, if time allows, as should-have); pollen as an authoritative/alertable signal.

## Known Limitations (to state proactively, not hide)
- IMD's own data is simulated in this build because official API access is IP-whitelist-gated and outside the team's control in this timeframe (see dossier §2).
- Pollen has no confirmed validated Indian data source; excluded or shown only as illustrative.
- Marine/tide has no confirmed public self-serve developer API found; excluded from MVP.
- The golden evaluation set is small (20–30 scenarios) and hand-annotated by the team, not an independent benchmark — reported as such, not oversold.
