# 00 — Team Execution Dependencies

Dependency ordering only — not individual task assignment (per instructions, task division comes after this).

## Can Start Immediately, in Parallel, With No Blockers
- `/engine` core logic + unit tests (`06_...md`, `10_...md` §1) — zero dependencies on anything external.
- `/adapters/sun_adapter` (local astronomy calc) — zero dependencies.
- `/adapters/forecast_adapter` + `warning_adapter` fixture design (IMD-shaped simulated data) — zero dependencies, needs only the field list already documented in the dossier's IMD API section.
- `07_api_and_data_contracts.md` finalization discussion between whoever owns backend and whoever owns frontend — needs no external access, just the two people in a room with the schema.
- `05_evaluation_dataset_and_annotation_plan.md` golden-set authoring — needs no external access (draft records now, refine value ranges once real AQI/UV samples exist).
- `09_ux_ui_specification.md` screen-level implementation (S1–S5 structure/flow) against stub data — no dependency on live adapters.
- Filing the IMD API whitelisting request (see `HUMAN_RESEARCH_AND_ACCESS_CHECKLIST.md`) — should start today regardless of build progress, since it has an unknown, possibly long turnaround.
- data.gov.in, aqicn.org, OpenWeatherMap registration (see `HUMAN_RESEARCH_AND_ACCESS_CHECKLIST.md`) — should start today.

## Blocked / Dependent Work
- `/adapters/aqi_adapter`, `/adapters/uv_adapter` **live-path testing** — blocked on credential registration completing (not blocked on writing the code against recorded sample fixtures, which can start immediately).
- `/backend` full wiring (engine + adapters + cache behind the real contract) — blocked on (a) engine core existing and (b) `07_...md` contract being finalized; not blocked on live AQI/UV credentials, since adapters can run in simulated/fixture mode first.
- `/frontend` final integration (replacing stub payloads with real backend responses) — blocked on `/backend` being stable enough to serve the real contract shape.
- Feasibility spike (`04_...md`) execution — blocked only on engine core existing; explicitly **not** blocked on backend, frontend, or live credentials, so it should run early (day 2–3), not late.
- Demo-day rehearsal (`12_...md`, `10_...md` §6) — blocked on full integration (backend + frontend + at least one real adapter working) being stable.

## Must Be Validated Before Final Implementation Decisions Are Locked
- **Confidence-factor constants** in `03_...md` §4 (e.g., `simulated=0.7`) are placeholders — must be sanity-checked against spike results before being treated as final (Flag 7 in `00_consistency_check_and_flags.md`). Do not hardcode these as permanent before the spike runs.
- **Whether the engine actually beats the static-persona baseline** (spike GO/CONDITIONAL/PIVOT outcome) — must be known before committing further build time to the full 3-persona UI polish. A PIVOT result should trigger a scope conversation, not be discovered on demo day.
- **CPCB/OpenWeatherMap actual rate limits and registration turnaround** — must be confirmed in practice, not assumed from documentation, before the data integration order in `08_...md` §6 can be trusted to hold on schedule.
- **INCOIS public API existence** (Flag 1) — one time-boxed check, only relevant if the team wants to reconsider the marine persona for the should-have list; not a blocker for MVP as currently scoped.

## Dependency Chain Summary (shortest path to a demoable system)
```
engine core + unit tests  ──┐
sun/forecast/warning adapters ──┼──► spike run (04_...md) ──► confidence-factor sanity check
07_...md contract lock ──┘                                            │
                                                                        ▼
credential registration ──► aqi/uv adapters (live) ──► backend wiring ──► frontend integration ──► demo rehearsal
```
The engine + fixture-adapter path and the credential-registration + live-adapter path are independent until backend wiring — this is the parallelism the 6-person team should exploit; nothing about validating the core product idea (the spike) waits on external API access.

## Readiness Check
This file, together with `10_...md` §6 (demo-day checklist) and `11_...md` §6 (build order), is sufficient to divide work by module/person. Actual task division should follow the module boundaries in `06_system_architecture.md` (engine / adapters / backend / frontend / eval), not be decided ad hoc.
