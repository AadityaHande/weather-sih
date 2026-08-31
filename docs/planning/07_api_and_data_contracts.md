# 07 — API and Data Contracts

Implements the module boundaries in `06_system_architecture.md`. All payloads are JSON. This file is the binding interface contract between frontend, backend, engine, and adapters.

## 1. Normalized Context/Data Model (`ContextFrame`)

Formal schema for the object defined conceptually in `03_personalization_logic_and_decision_matrix.md` §2:

```json
{
  "user": {
    "has_declared_profile": false,
    "personas": ["default_general"],
    "health_flags": []
  },
  "time": {
    "local_time": "2026-08-26T18:40:00+05:30",
    "is_commute_window": false,
    "is_daylight": true
  },
  "location": { "lat": 18.5204, "lon": 73.8567, "name": "Pune" },
  "environment": {
    "temp_c": 27.4,
    "feels_like_c": 29.1,
    "humidity_pct": 68,
    "wind_kmh": 14,
    "precip_prob_pct": 20,
    "warnings": [],
    "aqi": { "value": 96, "dominant": "pm2.5", "source": "live", "freshness_min": 12, "confidence": 1.0 },
    "uv": { "value": 6, "source": "live", "freshness_min": 40, "confidence": 1.0 },
    "pollen": { "value": null, "source": "simulated", "confidence": 0.5 },
    "sunrise": "06:12", "sunset": "18:52"
  }
}
```

Every environmental sub-object carries `{value, source, freshness_min|null, confidence}` — no exceptions. `source ∈ {"live","cached","simulated","unavailable"}`.

## 2. Frontend ↔ Backend Interface

### `GET /homepage`
Query: `device_id` (required — no login in MVP), `lat`, `lon` (required), `persona` (optional, omitted = cold-start default), `health_flags` (optional, comma-separated).

Response:
```json
{
  "context_snapshot_id": "ctx_8f2a...",
  "generated_at": "2026-08-26T18:40:03+05:30",
  "cards": [
    {
      "card_id": "aqi_health",
      "title": "Air Quality",
      "priority": "P1",
      "is_alert": true,
      "value_summary": "AQI 178 — Poor",
      "source": "live",
      "freshness_badge": null,
      "explanation_ref": "exp_aqi_health_001"
    }
  ],
  "warnings_override": []
}
```
Cards array is pre-sorted by priority (P0 first if present, then P1→P3). `warnings_override` is populated only when a P0 hard-rule override is active (per `03_...md` §5–6) and is rendered separately by the frontend, above the ranked list.

### `GET /explain?explanation_ref=`
Response:
```json
{
  "explanation_ref": "exp_aqi_health_001",
  "text": "AQI 178 (Poor) — 1.8× above your normal threshold, and you've flagged respiratory sensitivity → shown as a high-priority alert.",
  "signal_refs": [{ "signal": "aqi", "value": 178, "source": "live" }],
  "score_components": { "persona_weight": 0.9, "urgency_multiplier": 1.8, "confidence_factor": 1.0 }
}
```
`signal_refs` is what makes NFR-1 (traceability) checkable by a test, not just a claim (see `10_testing_and_validation_plan.md`).

### `GET /preferences` / `PUT /preferences`
```json
{ "device_id": "...", "personas": ["health"], "health_flags": ["respiratory_sensitive"], "saved_locations": [...] }
```
`PUT` is the only write endpoint needed for the MVP (no login, no server-side user accounts — device-scoped preferences only, stored locally per `06_...md` storage module).

## 3. Personalization Engine Input/Output Contract (backend ↔ engine, in-process — not a network call)

Input: one `ContextFrame` (§1).
Output:
```json
{
  "ranked_cards": [
    {
      "card_id": "aqi_health",
      "priority": "P1",
      "is_alert": true,
      "score": 1.62,
      "score_components": { "persona_weight": 0.9, "urgency_multiplier": 1.8, "confidence_factor": 1.0 },
      "explanation_text": "...",
      "signal_refs": [...]
    }
  ],
  "override_warnings": []
}
```
This is a pure function — same `ContextFrame` in, same output out, always (required for unit testing per `10_...md`).

## 4. Error / Degraded-Data Response Contract

The API **never returns a 5xx for a degraded-but-handled state.** Degradation is expressed as data, not as an HTTP error:

```json
{
  "cards": [
    {
      "card_id": "forecast_general",
      "priority": "P3",
      "is_alert": false,
      "value_summary": "Estimate unavailable",
      "source": "unavailable",
      "freshness_badge": "Data temporarily unavailable",
      "explanation_ref": "exp_forecast_general_unavail_001"
    }
  ],
  "system_notice": null
}
```
`system_notice` is populated only for a full-layer failure (e.g., entire environment fetch failed): `{"type":"stale_snapshot","message":"Showing last known data as of 14:02","as_of":"2026-08-26T14:02:00+05:30"}` — this is what backs the fallback banner in `03_...md` §12.

True HTTP error codes (4xx/5xx) are reserved for actual API misuse (bad `lat`/`lon`, missing `device_id`) — never for "a weather signal is down," which is an expected, designed-for state, not an exception.

## 5. Contract Invariants (must hold, testable)
- Every card in every response has a non-null `explanation_ref` that resolves via `/explain`.
- Every environmental sub-object has a non-null `source`.
- `override_warnings` is non-empty only when at least one `warnings` entry in the input `ContextFrame` met the P0 threshold.
- No `value_summary` string is ever generated from a `source: "unavailable"` signal without the word "estimate," "unavailable," or "last known" appearing in either `value_summary` or `freshness_badge`.
