# 10 — Testing and Validation Plan

Extends (does not replace) `04_personalization_feasibility_spike_plan.md` and `05_evaluation_dataset_and_annotation_plan.md`, which remain the authoritative spike/evaluation methodology. This file adds the surrounding engineering test layers and the demo-day checklist.

## 1. Unit Tests — Personalization Engine
Because the engine is a pure function (`06_...md` §2), it is fully unit-testable without any live data or UI:
- Given a fixed `ContextFrame`, output ranking is deterministic (same input → same output, run twice).
- P0 override always outranks any P1 card, regardless of score (test with an artificially high-scoring non-warning card alongside a warning).
- Changing only `user.personas` with identical `environment` produces a different card order for at least the AQI/UV/Rain cards (proves persona actually affects ranking — direct test against Risk R5).
- Changing only `environment` (e.g., raising AQI) with identical `user` produces a different priority for the AQI card (proves urgency_multiplier works independently of persona — also against R5).
- Cold-start `ContextFrame` (`has_declared_profile: false`) never produces an empty `ranked_cards` array.
- A `ContextFrame` with one signal `source: "unavailable"` never produces a card whose `value_summary` looks like a live number (regex/string check against Flag 8's invariant in `07_...md` §5).
- Every `ranked_cards[i].explanation_text` references at least one value present in `score_components` or `signal_refs` (automatable check against NFR-1).

## 2. Scenario Tests
Run the full golden set from `05_evaluation_dataset_and_annotation_plan.md` (20–30 records) as automated input/expected-output test cases once the engine exists — this is the same dataset, now used as a regression suite, not just a one-time spike. Any engine change that causes a previously-passing golden record to fail must be a deliberate, reviewed decision (update the record + `03_...md` together), never a silent regression.

## 3. API / Data Integration Tests
- Each adapter (AQI, UV, Sun, Forecast, Warning) tested independently: live call succeeds → correct schema; live call fails → cache/fallback triggers correctly; no cache available → `unavailable` state returned, never an exception bubbling to the frontend.
- Contract tests against `07_api_and_data_contracts.md` §5 invariants: every response's cards all have non-null `explanation_ref`; every environmental sub-object has non-null `source`; `override_warnings` populated iff a P0-threshold warning exists in input.
- Rate-limit behavior test: simulate exceeding OpenWeatherMap/CPCB free-tier limits, confirm graceful fallback to cache rather than a crash (directly de-risks the data-registration/rate-limit items in `08_...md` §5).

## 4. UI Tests
- S1–S5 screens (per `09_ux_ui_specification.md`) each render without crashing given: normal data, all-simulated data, one-signal-missing data, full-layer-failure data.
- Manual check: persona switch on S4 visibly reorders S2 within one interaction (no page reload flash that hides the reorder — this is a demo-critical UX detail, not cosmetic).
- Manual check: P0 warning banner never scrolls out of view alongside the card list.
- Manual check: every visible card has a non-empty, non-placeholder source/freshness badge.

## 5. Feasibility Spike Evaluation
Authoritative process is `04_personalization_feasibility_spike_plan.md` — run it early (days 2–3), against Engine vs. Baseline A (generic) vs. Baseline B (static persona), using the golden set. Do not skip this because unit tests pass — unit tests confirm the engine behaves as specified; the spike confirms the specification itself produces better outcomes than the two rejected patterns. These are different questions.

## 6. Demo-Day Acceptance Checklist
Directly operationalizes the 5 acceptance criteria in `13_final_mvp_specification.md`:
- [ ] Two personas selected live, same underlying weather state → visibly different card order + different explanations shown on stage.
- [ ] Context advanced (time change or warning injected) for the same persona → visibly different priority, same persona.
- [ ] Fresh device state (no preferences) → sensible non-empty homepage shown with zero setup.
- [ ] One data feed intentionally disabled mid-demo → visible degraded badge/banner appears, no crash, no silent wrong value.
- [ ] At least one card's explanation sheet opened live, showing `signal_refs` that match the value on the card.
- [ ] Offline/cached fallback snapshot for the demo location pre-loaded, tested at the venue if possible before presenting (per `08_...md` §5 contingency).

## 7. What Evidence Must Be Collected to Support Claims
| Claim made in the pitch | Evidence to have on hand |
|---|---|
| "Different users get different priority for the same weather" | Spike results table (top-1 match rate) + live demo |
| "The engine explains itself" | `/explain` output shown live + NFR-1 unit test passing |
| "It handles missing/stale data gracefully" | Live degraded-feed demo + adapter fallback test results |
| "It works for a brand-new user" | Cold-start unit test + live demo with a fresh device |
| "This beats a static persona template" | Spike's Baseline B comparison numbers — reported honestly, including if the margin is modest (per `04_...md` GO/CONDITIONAL/PIVOT framing) |
| "Our AQI/UV data is real" | Screenshot/log of the actual live API response used, with source badge visible in UI |

No claim above may be made in the final pitch without the corresponding evidence existing and being checkable — this is the same discipline `00_consistency_check_and_flags.md` already applied to the research documents, now applied to implementation claims.
