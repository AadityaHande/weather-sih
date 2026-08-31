# Frontend Developer Handoff — Mausam Personalized Homepage

> **For:** Frontend developer joining Phase 3 (Frontend integration)
> **Branch:** `milestone-2-adapters-backend`
> **Backend status:** Complete and tested. All ranking and personalization logic already runs server-side.

---

## What Already Exists (Do Not Rebuild)

The personalization engine and backend API are **complete**:

- `/homepage` — returns a fully ranked, ordered `cards[]` list, personalized to the requesting `device_id`
- `/explain` — returns a traceable explanation for any card (why it was ranked where it was)
- `/preferences` — stores and retrieves persona + health flags per device
- `/health` — backend + database liveness check

**The backend has already done the work of deciding which cards appear and in which order.** Your job is to render the result faithfully.

---

## Critical Rule: Do Not Re-rank on the Frontend

> **The frontend MUST NOT reorder, filter, or re-prioritize the cards returned by `/homepage`.**

The `cards[]` array is already sorted server-side — P0 first (if any, in `warnings_override[]`), then P1 → P3. Rendering them in any other order breaks the personalization contract and the explainability guarantee.

This also means: **do not hard-code persona-specific display logic in React components.** No `if (persona === "health") showAQIFirst()`. The backend handles that.

---

## Required Screens

Implement screens in this order:

### 1. S2 — Personalized Homepage (implement first)

**Entry point:** `GET /homepage?device_id=<id>&lat=<lat>&lon=<lon>`

Render:
- `warnings_override[]` — if non-empty, show this as a visually distinct banner **above** the ranked list, **not as a card inside the list**. This is a P0 hard-rule override (severe weather). It must always be visible without scrolling.
- `cards[]` — render in returned order. Do not sort.
- Per card: `title`, `value_summary`, `priority` (P0–P3, drives visual weight), `is_alert` (drives alert styling), `source` (drives freshness badge — see table below), `explanation_ref` (tappable — opens S3).
- `system_notice` — if not null, render a persistent top-of-screen banner (e.g. "Showing last known data as of 14:02"). Do not suppress it.
- `generated_at` — optionally show a "last updated" timestamp.

**Source badge rendering:**

| `source` value | Badge to show |
|---|---|
| `"live"` | Small "live" or "●" indicator |
| `"simulated"` | Persistent "Simulated for demo" badge |
| `"cached"` | "As of [time]" (use `freshness_badge` field) |
| `"unavailable"` | "Data unavailable" |

The `freshness_badge` field in `CardResponse` carries the pre-formatted badge string when relevant. Prefer that string over constructing your own.

### 2. S4 — Preferences / Persona Selector (implement second)

**Read:** `GET /preferences?device_id=<id>`
**Write:** `PUT /preferences` body: `{ device_id, personas, health_flags, saved_locations }`

Supported personas (these are the valid `personas[]` values in the current build):
- `"health"` — Health-conscious
- `"fitness"` — Outdoor fitness
- `"family"` — Parents & families
- `"default_general"` — cold-start default (assigned automatically; do not let users select this)

Supported `health_flags[]` values (optional, shown under health persona):
- `"respiratory_sensitive"` — elevates AQI card urgency
- `"pollen_interest"` — enables pollen card (currently stub — pollen fixture not yet implemented)

**UX rule:** changing persona must immediately re-fetch `/homepage`. The visible reorder of cards is the core "proof of personalization" demo beat. Do not add an "Apply" button delay.

**Multi-persona:** the API supports multiple personas simultaneously (e.g. `["health", "fitness"]`). Your UI can allow multi-select.

### 3. S3 — Explanation Sheet (implement third)

**Trigger:** tap on any card → open sheet/modal
**Request:** `GET /explain?explanation_ref=<explanation_ref from card>`

Render:
- `text` — the explanation string. Pre-formatted, human-readable. Do not paraphrase or rewrite it.
- `signal_refs[]` — a list of `{ signal, value, source }` objects. Show as a "Based on:" list with the actual values. This is what makes the explanations auditable — do not hide or collapse it.
- `score_components` — optionally show as a technical detail panel (persona_weight, urgency_multiplier, confidence_factor). Optional but useful for "innovation" demo.

### 4. S1 — Cold-Start / S5 — Loading + Degraded States

Cold-start (no preferences) works automatically — the backend returns sensible defaults. S1 = S2 with no persona set. No special frontend path needed.

For loading + degraded states:
- Use skeleton cards during initial load (do not block the whole screen)
- Per-card degraded: render the `source` badge and `freshness_badge` — they already represent the degraded state
- If `system_notice` is non-null, persist it at the top of the screen

---

## Data Flow

```
User changes persona (S4)
    ↓
PUT /preferences  ─────────────────→  Backend stores preference
    ↓
GET /homepage (re-issued)  ────────→  Backend: build_context_frame() in deps.py
                                           ↓
                                       Adapters called (AQI, UV, forecast, etc.)
                                           ↓
                                       engine.rank(ContextFrame) called
                                           ↓
                                       Ranked cards generated + explanations stored
    ←──────────────────────────────  HomepageResponse returned (pre-sorted cards[])
    ↓
Frontend renders cards[] in returned order
```

---

## API Reference

### `GET /homepage`

**Query:** `device_id` (string, required), `lat` (float -90–90), `lon` (float -180–180)

**Response:**
```json
{
  "context_snapshot_id": "ctx_8f2a3b",
  "generated_at": "2026-08-26T18:40:03+05:30",
  "system_notice": null,
  "cards": [
    {
      "card_id": "aqi_health",
      "title": "Air Quality",
      "priority": "P1",
      "is_alert": true,
      "value_summary": "AQI 165 — Poor",
      "source": "simulated",
      "freshness_badge": "Simulated for demo",
      "explanation_ref": "exp_aqi_health_8f2a3b"
    }
  ],
  "warnings_override": []
}
```

`warnings_override[]` entries (when a severe weather warning is active):
```json
{
  "severity": "red",
  "type": "thunderstorm",
  "text": "Severe thunderstorm warning — high winds expected"
}
```

### `GET /explain`

**Query:** `explanation_ref` (string, from card)

**Response:**
```json
{
  "explanation_ref": "exp_aqi_health_8f2a3b",
  "text": "AQI 165 (Poor), and this is particularly relevant to your declared persona — 1.8× the normal urgency threshold → shown as a high-priority alert.",
  "signal_refs": [{ "signal": "aqi", "value": 165, "source": "simulated" }],
  "score_components": { "persona_weight": 0.9, "urgency_multiplier": 1.8, "confidence_factor": 0.7 }
}
```

### `GET /preferences`

**Query:** `device_id`

**Response:**
```json
{
  "device_id": "abc123",
  "personas": ["health"],
  "health_flags": ["respiratory_sensitive"],
  "saved_locations": []
}
```

Returns cold-start defaults (`{ "personas": ["default_general"], "health_flags": [] }`) if no preferences are stored.

### `PUT /preferences`

**Body:**
```json
{
  "device_id": "abc123",
  "personas": ["health", "fitness"],
  "health_flags": ["respiratory_sensitive"],
  "saved_locations": []
}
```

**Response:** `{ "status": "ok" }`

### `GET /health`

**Response (healthy):** `{ "status": "ok", "db": "connected" }`
**Response (degraded):** HTTP 503 `{ "status": "degraded", "db": "unavailable" }`

---

## Frontend Tech Stack

From `frontend/package.json`:

| Package | Purpose |
|---|---|
| `next` 16.3 | App framework (App Router) |
| `react` 19 | UI library |
| `@tanstack/react-query` v5 | Data fetching + cache (use for `/homepage`, `/explain`, `/preferences`) |
| `lucide-react` | Icon library |
| `tailwindcss` v4 | Styling |
| `typescript` | Type safety |
| `vitest` | Unit testing |

---

## Important Implementation Rules

1. **Preserve backend card order.** `cards[]` is already sorted. Render it as-is.
2. **`warnings_override[]` goes above the card list.** Not inside it. Always visible without scrolling.
3. **Every card must show its `source` badge.** This is non-negotiable per the API contract — simulated data must always be disclosed.
4. **`explanation_ref` → `/explain` → show `signal_refs`.** The "Based on: AQI 165 (simulated)" list is what separates this from a generic weather dashboard. Do not hide it.
5. **No ranking logic in React.** Not even "show P0 first." The backend already does this. Trust the order.
6. **`system_notice` must render if non-null.** Do not suppress it.
7. **On persona change: re-fetch `/homepage` immediately.** The visible reorder is the demo.
8. **`device_id`** — generate once on first app open and store locally (e.g. `localStorage`). Do not require login.

---

## Backend Endpoints Base URL

For local development: `http://localhost:8000`

Start backend:
```bash
# From repo root
$env:DATABASE_URL = "postgresql://..."     # local Postgres or Neon DSN
$env:ADAPTER_MODE = "fixture"
uvicorn backend.main:app --reload
```

The backend handles CORS — `localhost:3000` (Next.js default dev port) is typically allowed if `CORS_ALLOWED_ORIGINS` includes it in settings.

---

## Suggested Implementation Order

1. **API client setup** — TanStack Query client, base URL, typed fetch functions for each endpoint
2. **Homepage page** — fetch `/homepage`, render `cards[]` with title/value_summary/priority/source badge
3. **`warnings_override` banner** — render above the card list, conditionally
4. **Preferences page** — fetch + update `/preferences`, trigger homepage refetch on save
5. **Explanation sheet** — fetch `/explain?explanation_ref=`, render in a bottom sheet or modal
6. **Loading + skeleton states** — skeleton cards during initial load
7. **Degraded card rendering** — source badge for `"unavailable"` and `"simulated"`
8. **`system_notice` banner** — persistent top banner when non-null
9. **End-to-end scenario testing** — run both example scenarios from `docs/planning/03_personalization_logic_and_decision_matrix.md §82–96`

---

## Key Source Files to Read

| File | Why |
|---|---|
| `docs/planning/07_api_and_data_contracts.md` | Authoritative API schema + contract invariants |
| `docs/planning/09_ux_ui_specification.md` | Screen specifications (S1–S5) |
| `docs/planning/03_personalization_logic_and_decision_matrix.md` | Engine behavior + example scenarios |
| `docs/planning/12_demo_and_judging_narrative.md` | The required demo beats — know what must be demonstrable |
| `backend/models_api.py` | Pydantic response models — exact field names |
| `engine/cards.py` | Card IDs and their descriptions (for display logic) |
