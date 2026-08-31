# 03 — Personalization Logic and Decision Matrix

This is the engineering source of truth for the Contextual Relevance Engine.

## 1. Inputs / Signals

**User/persona signals** (declared, optional): persona tag(s) [health / fitness-commuter / family], health flags [respiratory-sensitive, heat-sensitive, none], saved home/work locations, active-hours window.

**Context signals** (inferred): current lat/long, local time, day-of-week, is-commute-window (derived from active-hours), days-since-last-open (for staleness of "no history" state).

**Environmental signals**: current temp, feels-like, humidity, wind speed, precipitation probability (next 3h / today), active warning(s) + severity, AQI (+ dominant pollutant), UV index, sunrise/sunset time, pollen index (simulated/illustrative only, flagged).

**Meta signals per environmental input**: `source` (live-official / live-global-provider / simulated), `freshness` (timestamp / stale-threshold flag), `confidence` (derived from freshness + source type).

## 2. Context Representation

A single `ContextFrame` object per homepage render:
```
ContextFrame {
  user: { personas[], health_flags[], has_declared_profile: bool }
  time: { local_time, is_commute_window, is_daylight }
  location: { lat, lon, name }
  environment: { temp, humidity, wind, precip_prob, warnings[], aqi{value,dominant,source,freshness}, uv{value,source,freshness}, pollen{value,source:"simulated"}, sunrise, sunset }
}
```

## 3. Candidate Cards / Actions (MVP set)

| Card | Personas it's relevant to | Data used |
|---|---|---|
| Severe Weather Warning | All | warnings[] |
| AQI & Health Guidance | Health, Fitness | aqi, health_flags |
| UV & Sun Exposure | Health, Fitness | uv, sunrise/sunset |
| Best Outdoor Activity Window | Fitness | temp, wind, aqi, uv, sunrise/sunset |
| Rain / Commute Impact | Family, Fitness | precip_prob, is_commute_window |
| Sunrise/Sunset & Daylight | Fitness, general | sunrise, sunset |
| General Current Conditions | Fallback/cold-start, all | temp, humidity, wind |
| Pollen (illustrative) | Health (only if enabled) | pollen (flagged simulated) |

## 4. Relevance Scoring Method

`score(card, context) = persona_weight × urgency_multiplier × confidence_factor`

- **persona_weight**: base relevance of this card to the user's declared/default persona(s) (0–1, static lookup table per persona — this is *not* the whole decision, only one input).
- **urgency_multiplier**: derived from how far the signal is from a "normal" band (e.g., AQI 50→1.0x, AQI 150→1.8x, AQI 300→2.5x). Purely a function of the environmental signal, independent of persona — this is what prevents the engine from degenerating into a persona lookup table (mitigates Risk R5).
- **confidence_factor**: reduces score for stale/simulated data (e.g., live=1.0, cached-recent=0.9, simulated=0.7, stale-beyond-threshold=0.3) so degraded data naturally sinks in rank rather than being hidden or crashing.

## 5. Priority Levels
- **P0 — Override (hard rule, bypasses scoring):** active severe weather warning at or above defined severity threshold → always rendered first, regardless of persona.
- **P1 — High:** score ≥ 1.5× baseline.
- **P2 — Normal:** score between 0.7× and 1.5× baseline.
- **P3 — Low/background:** score < 0.7× baseline; shown lower on the page or collapsed.

## 6. Alert Logic
A card becomes an **alert** (visually distinct, push-notification-eligible) if: it is P0, OR its urgency_multiplier crosses a defined hard threshold (e.g., AQI > 200, UV > 8, heat index > defined danger band) **and** it is relevant to the user's declared health flags or default safety profile. Alerts are never suppressed by low confidence_factor — instead, a low-confidence alert is shown *with* a "based on limited/simulated data" disclosure, never hidden.

## 7. Recommendation Logic
Each P0/P1 card carries a short, structured "suggested action" derived from a lookup keyed on (card type × severity band) — e.g., AQI Poor + respiratory flag → "Consider limiting prolonged outdoor exertion; keep any prescribed inhaler accessible." Recommendations are pre-authored per severity band, not generated freely — this keeps them auditable and appropriate for a safety context (explicitly avoids the "AI hallucinated advice" risk).

## 8. Conflict Resolution
If two cards would occupy the same "top" slot (e.g., both AQI and Rain score P1 simultaneously): break ties by (1) P0 always wins outright, (2) higher urgency_multiplier wins, (3) if still tied, the card tied to a declared (not default) persona signal wins, (4) if still tied, stable order by card-definition priority (warnings > health > commute > general).

## 9. Uncertainty Handling
Every card's explanation must state when a value is uncertain (e.g., forecast precip_prob shown with its stated probability, not asserted as fact). Confidence_factor (§4) is the mechanism; UI must render a small freshness/source badge per card.

## 10. Missing-Data Handling
If a signal required for a card is entirely unavailable: the card is either (a) omitted if no safe default exists, or (b) shown with a clearly labelled "estimated" fallback if a safe default does exist (e.g., no live AQI → show yesterday's cached value with a "last known" badge, never fabricate a plausible-looking live number).

## 11. Cold-Start Behaviour
No declared profile → `user.personas = ["default_general"]`. Default general profile: persona_weight table favors Severe Warning > General Current Conditions > AQI/UV (using a moderate default weight, since AQI/UV matter to most people generally) > Sunrise/Sunset. This guarantees a sensible, non-empty, safety-first homepage with zero configuration, satisfying PS point 6 and FR-6.

## 12. Fallback Behaviour (system-level)
If the environmental data layer fails entirely (e.g., no network): render the last successfully cached ContextFrame with a persistent "showing last known data as of [time]" banner, never a blank screen or a crash.

## 13. Explanation Output
Explanation string is templated directly from the scoring components that fired, e.g.:
`"AQI 178 (Poor) — 1.8× above your normal threshold, and you've flagged respiratory sensitivity → shown as a high-priority alert."`
This guarantees NFR-1 (explanations traceable to real signal values) by construction, not by separate authoring.

---

## Example Scenarios

### Scenario A — Same weather, different users
Weather state: AQI 165 (Poor), UV 9 (Very High), light rain expected in 2 hours, no active warning.
- **User 1 (Health persona, respiratory flag):** AQI card → P1 alert, top of stack, explanation cites AQI 165 + respiratory flag. UV card → P2. Rain card → P3.
- **User 2 (Fitness persona, no health flags):** UV card → P1 (very high UV + outdoor activity relevance), Best Activity Window card recommends indoor/early-morning alternative, explanation cites UV 9. AQI card → P2 (still elevated, generic urgency_multiplier applies to everyone, but persona_weight is lower than for User 1). Rain card → P2 (affects activity timing).
- **User 3 (Family persona, commute window active):** Rain card → P1 (precip_prob relevant to commute window), explanation cites "light rain expected within your commute window." AQI → P2. UV → P3.

### Scenario B — Same user, context changes over the day
User: Fitness persona, no health flags. Location fixed.
- **7:00 AM:** AQI moderate, UV low (pre-sunrise), no warning → Sunrise/Activity Window card is P1 ("good conditions now").
- **1:00 PM:** UV index rises to 10, temp near heat-alert threshold → UV card and Best Activity Window (revised to suggest evening) jump to P1/P0-adjacent; same user, same persona, different priority driven purely by environmental state change.
- **6:00 PM:** A severe thunderstorm warning is issued → Warning card becomes P0 regardless of anything else, overriding the Activity Window card that was P1 minutes earlier.

These two scenarios are also the literal content basis for the golden evaluation set (`05_evaluation_dataset_and_annotation_plan.md`).
