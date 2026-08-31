# 09 — UX/UI Specification

Practical implementation spec, not a visual design document. Consistent with `01_prd.md` use cases and `03_personalization_logic_and_decision_matrix.md` behaviour.

## 1. Screens

### S1 — Cold-Start Homepage (first open, no preferences set)
- Shows immediately, zero configuration, per `03_...md` §11 default-general profile.
- A single, dismissible, low-emphasis prompt: "Personalize this? Tell us what matters to you" → links to S4 (Preferences), but is skippable and never blocks the homepage.
- Cards render per default-general priority ordering (Severe Warning if present > General Conditions > AQI/UV at moderate default weight > Sunrise/Sunset).

### S2 — Personalized Homepage (preferences set)
- Ranked card list per `07_api_and_data_contracts.md` `GET /homepage` response, sorted server-side (frontend does not re-sort).
- P0 override warning(s), if present, render in a visually distinct banner **above** the card list, not as a card in the ranked stack (structurally separate, matching `03_...md` §5–6).
- Each card shows: title, `value_summary`, priority-driven visual weight (P1 larger/top, P3 smaller/collapsed by default), and a source/freshness badge (per `06_...md` §4 table) — badge is always visible, never hidden behind a menu.
- Tapping a card opens the Explanation Sheet (S3).

### S3 — Explanation Sheet ("Why am I seeing this?")
- Triggered by tapping any card.
- Renders `/explain` response: plain-language `text`, plus a small "based on" list of the actual `signal_refs` (e.g., "AQI: 178, live"). This list is not optional — it is the concrete, checkable evidence that satisfies NFR-1 and is a scripted demo beat.
- Simulated/stale signals referenced in an explanation must say so here explicitly (e.g., "Rain forecast: 40% [simulated for demo]").

### S4 — Preferences / Persona Editor
- Select persona(s) from the 3 MVP personas (health, fitness/commuter, family) — multi-select allowed (a user can be both health-conscious and a parent).
- Toggle health flags (e.g., respiratory-sensitive) — optional, only shown under the health persona or always visible, team's call, not a novelty-relevant decision.
- Save triggers `PUT /preferences`; homepage re-fetches and visibly reorders — this reordering, done live in front of the user, is the core "look, it actually changed" moment.

### S5 — Degraded/Offline/Loading/Error States
- **Loading:** skeleton cards, not a blocking spinner over the whole screen — cards that already have cached data can render immediately while others are still loading.
- **Per-card degraded:** badge per §4 table in `06_...md` (e.g., "Simulated for demo," "Last known, 2h old," "Estimate unavailable") — rendered on the card itself, not a separate error screen.
- **Full-layer failure:** persistent top-of-screen banner: "Showing last known data as of [time]" (backed by `system_notice` in `07_...md` §4) — homepage still renders fully from cache, never blanks.
- **Hard error (bad request, e.g., no location permission granted):** a single explicit screen asking for location, with a manual-entry fallback (type a city name) — not a silent failure.

## 2. Cold-Start Flow (explicit, since PS point 6 requires it demoable)
```
App open (first time)
   → device_id generated locally, no login
   → GET /homepage with no persona/health_flags
   → default-general ContextFrame → engine → ranked cards
   → S1 renders immediately
   → optional prompt to personalize, dismissible
```
No screen in this flow may be empty or require input before showing something useful.

## 3. Homepage/Card Prioritization — UI Rules
- Priority is expressed spatially (order + size), not just by a label, so the "different order for different users" effect is visually obvious without reading text — important for the demo.
- P0 override is never inside the scroll of ranked cards; it is fixed above them, always visible without scrolling, even if the user has scrolled down.
- Re-ranking (persona change, time-based context change) must visibly animate/reorder, not silently reload — the demo depends on the reorder being seen happening, not just the end state.

## 4. Persona/Preferences Editing — UX Rules
- Changing persona must trigger an immediate homepage re-rank (no "Apply" button delay) so the demo can show it live.
- Health flags are additive modifiers to scoring (per `03_...md` §4 persona_weight), not a separate persona — UI should reflect this (flags nested under/alongside persona selection, not a competing top-level choice).

## 5. What This Spec Deliberately Leaves Open
Visual design system, color palette, iconography, exact component library — none of these affect the novelty claim or the engine, and are lower priority than getting the ranking/explanation/degradation behaviour correct and visible. Teams should timebox visual polish and never let it delay S1–S5 functional correctness.
