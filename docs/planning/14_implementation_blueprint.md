# 14 — Implementation Blueprint (Pair A: Core Website/Product)

Cross-checked against `13_final_mvp_specification.md`, `03_...md`, `06_...md`, `07_...md`, `08_...md`, `09_...md`, `10_...md`, `11_...md`, `00_team_execution_dependencies.md`. No genuine technical contradiction was found between these documents — one small **ambiguity** (not a contradiction) is resolved below in §4 rather than flagged as an issue: the `PUT /preferences` contract in `07_...md` doesn't state whether `device_id` is a path param, query param, or body field. Resolved here as a body field (simplest, one endpoint shape, no route param duplication) — this is an implementation choice within the existing contract's freedom, not a change to it.

Everything below locks concrete decisions. Nothing here changes the MVP, personas, architecture, or novelty claim.

---

## 1. Final Tech Stack

| Layer | Choice | Why (brief) |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + TypeScript + Tailwind CSS** | Matches `09_...md` screen/route model directly; TypeScript catches contract-shape mismatches at compile time, which matters more than usual here because `07_...md` is a binding contract |
| Backend | **FastAPI (Python 3.11+)** | Pydantic models map 1:1 onto `07_...md` JSON contract with validation for free; async support suits calling 2 external APIs (AQI, UV) without blocking; Python keeps engine + backend in one language, simplifying the "engine has zero framework deps" rule from `06_...md` §2 |
| Engine | **Plain Python module, stdlib only** | Per `06_...md` §2: pure function, no I/O. No framework, no FastAPI import inside `/engine` at all — enforced by folder boundary (§2 below) |
| Database | **SQLite** (via `sqlalchemy` or raw `sqlite3`) | See §7 — sufficient for MVP scope, zero infra to stand up, file-based, trivial to reset for a demo |
| Caching/fallback | **SQLite table with TTL column** — no Redis | `06_...md`'s caching layer only needs last-known-good-per-signal lookups; a second service is an "unnecessary service" per the brief |
| UI components | **Tailwind utility classes + `lucide-react` icons**, no component library | Keeps bundle small, no theming system to fight; `shadcn/ui` is unnecessary for 5 screens |
| Data fetching (frontend) | **TanStack Query (`@tanstack/react-query`)** | Gives automatic refetch-on-preference-change (the "live re-rank" requirement in `09_...md`) without hand-rolled state management |
| Testing | **pytest** (engine + backend), **Vitest + React Testing Library** (frontend, light) | Matches `10_...md` unit/contract test structure directly |
| Deployment | **Backend: Render or Railway (free tier). Frontend: Vercel.** | Matches `11_...md` §5 "any simple host" guidance; both have zero-config deploys from a git push, appropriate for a 1–2 week MVP |

Rejected: Node/Express backend (Python's simplicity for the engine + adapters outweighs any Node-frontend-language-unification benefit), Postgres/Supabase (no multi-user concurrency need, no auth, adds infra for no MVP benefit), Redis (SQLite TTL table covers the actual requirement).

---

## 2. Repository Architecture (exact folders)

```
sih26076-mausam/
├── engine/                        # PURE LOGIC — no imports from fastapi, requests, sqlite3, etc.
│   ├── __init__.py
│   ├── models.py                  # dataclasses/TypedDicts: ContextFrame, RankedCard, EngineOutput
│   ├── cards.py                   # CARD_DEFINITIONS registry (03_...md §3)
│   ├── scoring.py                 # persona_weight table, urgency_multiplier(), confidence_factor()
│   ├── priority.py                # classify P0–P3, is_alert()
│   ├── conflict.py                # tie-break resolver (03_...md §8)
│   ├── explain.py                 # explanation_text + signal_refs generator (03_...md §13)
│   ├── engine.py                  # rank(context_frame) -> EngineOutput — the single public entrypoint
│   └── tests/
│       ├── test_scoring.py
│       ├── test_priority_override.py
│       ├── test_cold_start.py
│       └── test_missing_data.py
│
├── adapters/                      # I/O boundary — network/fixture reads happen ONLY here
│   ├── __init__.py
│   ├── base.py                    # Adapter ABC: fetch(lat, lon, when) -> SignalResult
│   ├── aqi_adapter.py             # data.gov.in -> aqicn.org fallback -> cache -> unavailable
│   ├── uv_adapter.py              # OpenWeatherMap One Call
│   ├── sun_adapter.py             # local astronomy calc (astral library)
│   ├── forecast_adapter.py        # fixture-backed, IMD-shaped
│   ├── warning_adapter.py         # fixture-backed, IMD-shaped, scriptable for demo
│   ├── fixtures/
│   │   ├── forecast_normal.json
│   │   ├── forecast_rain_commute.json
│   │   ├── forecast_heat_uv_spike.json
│   │   ├── warning_severe.json
│   │   └── aqi_uv_recorded_samples.json   # for dev without live credentials, §6
│   └── tests/
│       ├── test_aqi_adapter.py
│       ├── test_uv_adapter.py
│       └── test_fixture_adapters.py
│
├── cache/                         # caching/fallback layer between adapters and backend
│   ├── __init__.py
│   ├── store.py                   # SQLite-backed get/set/is_stale per (signal, lat, lon)
│   └── tests/
│
├── backend/                       # FastAPI app — implements 07_api_and_data_contracts.md exactly
│   ├── main.py                    # app instance, router mounting
│   ├── db.py                      # SQLite engine/session setup (preferences table)
│   ├── models_api.py              # Pydantic request/response models mirroring 07_...md JSON exactly
│   ├── deps.py                    # wiring: adapters + cache + engine, injected via FastAPI Depends
│   ├── routers/
│   │   ├── homepage.py            # GET /homepage
│   │   ├── explain.py             # GET /explain
│   │   └── preferences.py         # GET/PUT /preferences
│   └── tests/
│       ├── test_homepage_contract.py
│       ├── test_explain_contract.py
│       └── test_degraded_response.py
│
├── frontend/                      # Next.js app
│   ├── app/
│   │   ├── page.tsx                        # S1/S2 — homepage (cold-start and personalized are the same route)
│   │   ├── preferences/page.tsx            # S4 — persona/health-flag editor
│   │   └── layout.tsx
│   ├── components/
│   │   ├── CardList.tsx
│   │   ├── Card.tsx
│   │   ├── WarningBanner.tsx               # P0 override, fixed above CardList
│   │   ├── ExplanationSheet.tsx            # S3
│   │   ├── SourceBadge.tsx                 # live/cached/simulated/stale/unavailable badge
│   │   ├── PersonaSelector.tsx
│   │   └── DegradedBanner.tsx              # full-layer fallback banner
│   ├── lib/
│   │   ├── api.ts                          # typed fetch wrappers matching 07_...md contract
│   │   ├── deviceId.ts                     # generates/persists device_id in localStorage
│   │   └── types.ts                        # TS types mirroring backend Pydantic models
│   └── tests/
│
├── eval/                          # golden set + spike runner (05_...md, 04_...md) — not part of runtime app
│   ├── golden_set.json
│   └── run_spike.py                # engine vs. Baseline A/B, per 04_...md
│
└── docs/                          # the entire existing planning doc set — copied here as-is, not duplicated in code comments
```

**Boundary rule, restated for enforcement:** `/engine` must not import `fastapi`, `requests`, `sqlite3`, or anything from `/adapters`, `/backend`, or `/cache`. Add a CI/lint check (even a simple `grep` in a pre-commit hook) that fails the build if `/engine/*.py` imports any of those — this is cheap insurance against the exact failure mode Risk R5/R6 in `00_risk_register.md` describes.

---

## 3. Engine Implementation Plan

All of this translates `03_personalization_logic_and_decision_matrix.md` directly — no logic changes, only concrete shape.

**`engine/models.py`**
```python
from dataclasses import dataclass, field
from typing import Literal

Source = Literal["live", "cached", "simulated", "stale", "unavailable"]

@dataclass
class SignalValue:
    value: float | int | str | None
    source: Source
    freshness_min: int | None
    confidence: float  # 0.0–1.0, per 03_...md §4

@dataclass
class ContextFrame:
    personas: list[str]              # e.g. ["health"], or ["default_general"] for cold-start
    health_flags: list[str]
    has_declared_profile: bool
    local_time: str                  # ISO 8601
    is_commute_window: bool
    is_daylight: bool
    lat: float
    lon: float
    temp_c: SignalValue
    humidity_pct: SignalValue
    wind_kmh: SignalValue
    precip_prob_pct: SignalValue
    warnings: list[dict]             # [{severity, type, text}], empty if none
    aqi: SignalValue                 # .value carries {"aqi":178,"dominant":"pm2.5"} — see note below
    uv: SignalValue
    pollen: SignalValue | None
    sunrise: str
    sunset: str

@dataclass
class RankedCard:
    card_id: str
    priority: Literal["P0", "P1", "P2", "P3"]
    is_alert: bool
    score: float
    score_components: dict           # {persona_weight, urgency_multiplier, confidence_factor}
    explanation_text: str
    signal_refs: list[dict]          # [{"signal":"aqi","value":178,"source":"live"}]

@dataclass
class EngineOutput:
    ranked_cards: list[RankedCard]
    override_warnings: list[RankedCard]
```
Note: `aqi.value` and similar composite signals carry a small dict rather than a bare scalar to preserve `dominant pollutant` etc. per the `03_...md` §2 schema — keep this consistent with the backend's `models_api.py` mapping in §4.

**`ContextFrame` validation** — a plain function, not a class method (keeps engine free of framework-style validators):
```python
def validate_context_frame(cf: ContextFrame) -> list[str]:
    """Returns a list of validation error strings; empty list = valid."""
    errors = []
    if not cf.personas: errors.append("personas must be non-empty (use ['default_general'] for cold-start)")
    if not (-90 <= cf.lat <= 90): errors.append("lat out of range")
    if not (-180 <= cf.lon <= 180): errors.append("lon out of range")
    for sig_name, sig in [("aqi", cf.aqi), ("uv", cf.uv)]:
        if sig.confidence < 0 or sig.confidence > 1:
            errors.append(f"{sig_name}.confidence out of 0–1 range")
    return errors
```
Backend calls this before invoking `engine.rank()`; on non-empty errors, backend returns a 4xx (malformed input is a genuine API-misuse case, per `07_...md` §4 — distinct from a degraded-data case, which is not an error).

**`engine/cards.py`** — the registry from `03_...md` §3, as data, not hardcoded branches:
```python
CARD_DEFINITIONS = {
    "severe_warning":     {"personas": ["*"], "base_priority_floor": "P0"},
    "aqi_health":         {"personas": ["health", "fitness"]},
    "uv_sun_exposure":    {"personas": ["health", "fitness"]},
    "activity_window":    {"personas": ["fitness"]},
    "rain_commute":       {"personas": ["family", "fitness"]},
    "sunrise_sunset":     {"personas": ["fitness", "default_general"]},
    "general_conditions": {"personas": ["*"]},   # cold-start / fallback
    "pollen_illustrative":{"personas": ["health"], "alertable": False},
}
```

**`engine/scoring.py`** — implements §4 exactly:
```python
PERSONA_WEIGHT = {
    ("aqi_health", "health"): 0.9, ("aqi_health", "fitness"): 0.5, ("aqi_health", "family"): 0.4,
    ("aqi_health", "default_general"): 0.6,
    ("uv_sun_exposure", "health"): 0.6, ("uv_sun_exposure", "fitness"): 0.9,
    ("rain_commute", "family"): 0.95, ("rain_commute", "fitness"): 0.6,
    ("activity_window", "fitness"): 0.95,
    ("sunrise_sunset", "fitness"): 0.5, ("sunrise_sunset", "default_general"): 0.4,
    ("general_conditions", "default_general"): 0.7,
    # ... remaining pairs per 03_...md §3 table — fill during build, values are DESIGN placeholders
    # per Flag 7 in 00_consistency_check_and_flags.md; sanity-check against eval/run_spike.py output.
}

def urgency_multiplier(card_id: str, cf: ContextFrame) -> float:
    if card_id == "aqi_health":
        v = cf.aqi.value["aqi"]
        if v >= 300: return 2.5
        if v >= 150: return 1.8
        if v >= 100: return 1.3
        return 1.0
    if card_id == "uv_sun_exposure":
        v = cf.uv.value
        if v >= 11: return 2.2
        if v >= 8: return 1.8
        if v >= 6: return 1.2
        return 1.0
    # ... one branch per card, each a pure function of environment values only (never persona) —
    # this independence is what §4 of 03_...md relies on to prove personalization isn't a lookup table.
    return 1.0

CONFIDENCE_BY_SOURCE = {"live": 1.0, "cached": 0.9, "simulated": 0.7, "stale": 0.3, "unavailable": 0.0}

def confidence_factor(signal: SignalValue) -> float:
    return CONFIDENCE_BY_SOURCE[signal.source]

def score(card_id: str, persona: str, cf: ContextFrame) -> tuple[float, dict]:
    pw = PERSONA_WEIGHT.get((card_id, persona), 0.2)  # low default if no explicit weight defined
    um = urgency_multiplier(card_id, cf)
    primary_signal = _primary_signal_for(card_id, cf)   # helper mapping card_id -> its SignalValue
    cfac = confidence_factor(primary_signal)
    return pw * um * cfac, {"persona_weight": pw, "urgency_multiplier": um, "confidence_factor": cfac}
```

**`engine/priority.py`** — thresholds from §5:
```python
def classify_priority(card_id: str, score: float, cf: ContextFrame) -> str:
    if card_id == "severe_warning" and cf.warnings:
        return "P0"
    if score >= 1.5: return "P1"
    if score >= 0.7: return "P2"
    return "P3"

def is_alert(card_id: str, priority: str, urgency: float, cf: ContextFrame) -> bool:
    if priority == "P0": return True
    HARD_ALERT_THRESHOLDS = {"aqi_health": 1.8, "uv_sun_exposure": 1.8}  # matches urgency bands above
    return CARD_DEFINITIONS.get(card_id, {}).get("alertable", True) and urgency >= HARD_ALERT_THRESHOLDS.get(card_id, 999)
```

**`engine/conflict.py`** — §8 tie-break, applied only when two cards land in the same priority bucket and a strict order is needed for card position:
```python
CARD_DEFINITION_ORDER = ["severe_warning", "aqi_health", "rain_commute", "uv_sun_exposure",
                          "activity_window", "sunrise_sunset", "general_conditions", "pollen_illustrative"]

def resolve_ties(cards: list[RankedCard], declared_persona_card_ids: set[str]) -> list[RankedCard]:
    def sort_key(c):
        return (
            0 if c.priority == "P0" else 1,
            -c.score_components["urgency_multiplier"],
            0 if c.card_id in declared_persona_card_ids else 1,
            CARD_DEFINITION_ORDER.index(c.card_id),
        )
    return sorted(cards, key=sort_key)
```

**`engine/explain.py`** — §13, templated (not free-generated):
```python
EXPLANATION_TEMPLATES = {
    "aqi_health": "{signal_value} AQI ({band}) — {urgency}x above your normal threshold{persona_clause} → shown as {priority_label}.",
}
def build_explanation(card_id, priority, score_components, signal_refs, cf) -> str:
    # pulls from EXPLANATION_TEMPLATES, formats using signal_refs values — never free-text/LLM.
    ...
```

**`engine/engine.py`** — the one public entrypoint:
```python
def rank(cf: ContextFrame) -> EngineOutput:
    errors = validate_context_frame(cf)
    if errors:
        raise ValueError(errors)  # backend catches this and returns 4xx per §4 above
    ranked = []
    for card_id in CARD_DEFINITIONS:
        if not _card_applies(card_id, cf):    # missing-data handling, 03_...md §10
            continue
        best_persona = _best_persona_for_card(card_id, cf.personas)
        s, components = score(card_id, best_persona, cf)
        priority = classify_priority(card_id, s, cf)
        alert = is_alert(card_id, priority, components["urgency_multiplier"], cf)
        signal_refs = _signal_refs_for(card_id, cf)
        explanation = build_explanation(card_id, priority, components, signal_refs, cf)
        ranked.append(RankedCard(card_id, priority, alert, s, components, explanation, signal_refs))
    ranked = resolve_ties(ranked, declared_persona_card_ids=_declared_ids(cf))
    p0 = [c for c in ranked if c.priority == "P0"]
    rest = [c for c in ranked if c.priority != "P0"]
    return EngineOutput(ranked_cards=rest, override_warnings=p0)
```
`_card_applies()` is where §10 missing-data logic lives: a card is skipped entirely if its required signal is `unavailable` and no safe default exists (e.g., `activity_window` needs temp+wind+aqi+uv — if all are unavailable, skip; if only one is unavailable, substitute the last-known-good already baked into the `SignalValue` by the cache layer before it ever reaches the engine — the engine itself never fetches or guesses, it only reads what's already in `ContextFrame`).

---

## 4. Backend Plan (FastAPI)

Endpoints — exactly the three in `07_...md`, no additions:

**`GET /homepage`**
Query params: `device_id: str`, `lat: float`, `lon: float`. (`persona`/`health_flags` query overrides are dropped in favor of always reading current saved preferences by `device_id` — simpler, avoids two competing sources of truth for the same session; if Pair A wants ad-hoc persona preview without saving, that's a `frontend`-only optimistic-UI concern, not a backend contract change.)
Flow: load preferences from SQLite by `device_id` (or default-general if none exist, §7) → call each adapter via `deps.py` → assemble `ContextFrame` → `engine.rank()` → map `EngineOutput` to the `07_...md` JSON response shape → return.

**`GET /explain`**
Query: `explanation_ref: str`. Backend must persist the last-rendered `RankedCard` set per `device_id` (in-memory dict or SQLite, TTL a few minutes) so `explanation_ref` can resolve back to the exact card/scoring that produced it — this is required to satisfy the "tap a card, explanation matches" testing checkpoint (§11) and is the one piece of state not explicitly detailed in `07_...md`, resolved here as: `explanation_ref = f"{device_id}:{card_id}:{context_snapshot_id}"`, looked up from a short-lived server-side cache populated by the preceding `/homepage` call.

**`GET /preferences` / `PUT /preferences`**
Straight SQLite read/write keyed by `device_id` (body field, per the resolved ambiguity in this file's header).

**`backend/models_api.py`** — Pydantic models mirror `07_...md` JSON exactly, field-for-field (`card_id`, `title`, `priority`, `is_alert`, `value_summary`, `source`, `freshness_badge`, `explanation_ref`; `warnings_override`; `/explain`'s `text`, `signal_refs`, `score_components`). Do not rename fields for "cleaner" Python style — the contract is the source of truth, not backend convenience.

**`backend/deps.py`** — FastAPI `Depends()` providers for: `AQIAdapter`, `UVAdapter`, `SunAdapter`, `ForecastAdapter`, `WarningAdapter`, `CacheStore`, and a thin `build_context_frame(prefs, lat, lon) -> ContextFrame` function that calls all adapters (via `cache/store.py`, which itself tries live → cache → unavailable per `08_...md` §2) and assembles the dataclass from §3 above.

**Internal request flow for `GET /homepage`:**
```
request → load preferences (SQLite) → build_context_frame()
   → [AQIAdapter.fetch() through cache/store.py]
   → [UVAdapter.fetch() through cache/store.py]
   → [SunAdapter.compute() — direct, no cache needed]
   → [ForecastAdapter.fetch(), WarningAdapter.fetch() — fixture reads]
   → engine.rank(context_frame)
   → map EngineOutput → 07_...md JSON shape
   → store ranked cards keyed by explanation_ref for subsequent /explain calls
   → response
```

---

## 5. Frontend Plan (Next.js)

- **`app/page.tsx`** — single route serves both S1 (cold-start) and S2 (personalized); behavior is identical code path, driven entirely by what `/homepage` returns for the current `device_id` (no client-side branching between "new user" and "returning user" beyond what the API already encodes — matches `09_...md` §2's explicit rule that cold-start must not be a separate blocking screen).
- On mount: `lib/deviceId.ts` reads/creates a `device_id` in `localStorage` (UUID v4) → TanStack Query fetches `/homepage?device_id=...&lat=...&lon=...` (lat/lon from browser geolocation, with a manual-entry fallback per `09_...md` §1 S5 hard-error case).
- **`WarningBanner`** renders `override_warnings` (fixed, above `CardList`, never scrolls away — per `09_...md` §3).
- **`CardList` → `Card`** renders `cards[]` in the order the backend returned (frontend never re-sorts, per `06_...md` §2's "frontend never computes ranking" rule). Each `Card` shows `title`, `value_summary`, a size/weight driven by `priority` (P1 larger, P3 smaller/collapsed), and `<SourceBadge source={card.source} freshnessBadge={card.freshness_badge} />`.
- Tapping a `Card` opens `ExplanationSheet`, which fetches `/explain?explanation_ref=...` and renders `text` plus the `signal_refs` list verbatim (this is the literal, checkable "numbers match" demo moment from `12_...md` §1 step 3).
- **`PersonaSelector`** (in `app/preferences/page.tsx`) on change calls `PUT /preferences`, then invalidates the TanStack Query cache key for `/homepage` so the homepage re-fetches and re-renders immediately on navigating back — this is what makes the "visibly reorder" requirement in `13_...md` acceptance criterion 1 actually visible rather than requiring a manual refresh.
- **`DegradedBanner`** renders when the `/homepage` response's `system_notice` (per `07_...md` §4) is non-null — persistent top banner, per `09_...md` §1 S5.
- Re-rank animation: wrap `CardList` items in a simple CSS transition keyed by `card_id` (e.g., Framer Motion's `layout` prop, or a plain CSS `transition: transform` if avoiding an extra dependency) so reordering is seen happening, not just the end state — directly required by `09_...md` §3's "must visibly animate/reorder" rule and the demo script in `12_...md`.

---

## 6. Data Adapter Plan

**`adapters/base.py`**
```python
from abc import ABC, abstractmethod
class Adapter(ABC):
    @abstractmethod
    def fetch(self, lat: float, lon: float, when: str) -> "SignalValue": ...
```
Every adapter (AQI, UV, Sun, Forecast, Warning) implements this same shape, regardless of live vs. simulated — this is what §5 of `06_...md` depends on ("engine doesn't know or care" — true one level up too: the cache layer and backend don't need adapter-specific branching either).

**Fixture mode** — controlled by an environment variable, so development starts day 1 without any credentials:
```
ADAPTER_MODE=fixture   # AQIAdapter/UVAdapter read from adapters/fixtures/aqi_uv_recorded_samples.json
ADAPTER_MODE=live      # AQIAdapter/UVAdapter make real HTTP calls
FIXTURE_SCENARIO=normal | rain_commute | heat_uv_spike | severe_warning   # selects ForecastAdapter/WarningAdapter fixture file
```
`ForecastAdapter`/`WarningAdapter` are **always** fixture-backed in the MVP (per `13_...md` — this isn't conditional on `ADAPTER_MODE`, since there is no live IMD path at all yet); only `AQIAdapter`/`UVAdapter` have a real `live` mode.

```python
# adapters/aqi_adapter.py
class AQIAdapter(Adapter):
    def fetch(self, lat, lon, when):
        if settings.ADAPTER_MODE == "fixture":
            return self._from_fixture(lat, lon)
        try:
            return self._from_data_gov_in(lat, lon)       # primary
        except (Timeout, HTTPError):
            try:
                return self._from_aqicn(lat, lon)          # fallback, 08_...md §2
            except (Timeout, HTTPError):
                cached = cache_store.get("aqi", lat, lon)
                if cached and not cache_store.is_stale(cached):
                    return cached._replace(source="cached")
                elif cached:
                    return cached._replace(source="stale", confidence=0.3)
                return SignalValue(value=None, source="unavailable", freshness_min=None, confidence=0.0)
```
`SunAdapter` uses the `astral` package (real, pip-installable) for lat/lon/date → sunrise/sunset, no network call, `source` always `"live"` since it's a deterministic calculation, not a fetched value — consistent with `08_...md` §2's "no fallback needed" note.

---

## 7. Database/Persistence Decision

> **SUPERSEDED — see `16_production_architecture_reassessment.md` §1.** SQLite's file-based storage does not survive Render/Railway's ephemeral filesystem in production; the backend uses **Neon (serverless Postgres)** everywhere. The reasoning below is kept for historical context but the recommendation itself no longer applies. Do not implement SQLite.

~~SQLite is sufficient for this MVP.~~ No Supabase/Firebase — there's no multi-region need, no auth, no real-time sync requirement (`06_...md` §1 storage module already scopes this narrowly), and a single demo device/session doesn't need concurrent-write handling beyond what SQLite trivially provides.

**Exact tables:**
```sql
CREATE TABLE preferences (
  device_id TEXT PRIMARY KEY,
  personas TEXT NOT NULL,          -- JSON array, e.g. '["health"]'
  health_flags TEXT NOT NULL,      -- JSON array
  saved_locations TEXT,            -- JSON array, nullable
  updated_at TEXT NOT NULL
);

CREATE TABLE signal_cache (
  cache_key TEXT PRIMARY KEY,      -- e.g. "aqi:18.52:73.86" (lat/lon rounded to ~2dp for cache locality)
  value_json TEXT NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
```
No `users` table (no login, per the existing cold-start design — `device_id` is a client-generated, unauthenticated identifier, not an account). No table for the golden evaluation set — that stays a JSON file in `/eval`, since it's a build-time/test-time artifact, not runtime application data. `explanation_ref` lookups (§4) can be an in-memory dict for the MVP (acceptable since it's short-TTL, single-process) — only move it into SQLite if the backend needs to survive a restart mid-demo, which is unlikely to matter for a hackathon deployment.

---

## 8. Step-by-Step Build Order

**Phase 1 — Foundation (no external dependencies, both devs can start same hour)**
1. Repo skeleton (§2 folder structure), `pyproject.toml`/`requirements.txt`, `package.json`, `.gitignore`, pre-commit boundary-check hook (§2).
2. `engine/models.py` + `engine/cards.py` — data shapes, no logic yet.
3. `engine/scoring.py` + `engine/priority.py` + `engine/conflict.py` + `engine/explain.py` + `engine/engine.py` — full logic per §3.
4. `engine/tests/*` — the four test files in §2, all passing against hand-built `ContextFrame` fixtures (no adapters needed yet).

**Phase 2 — First vertical slice (fixture-only, still no credentials needed)**
5. `adapters/sun_adapter.py`, `adapters/forecast_adapter.py`, `adapters/warning_adapter.py` + the 4 fixture JSON files.
6. `cache/store.py` (SQLite-backed get/set/is_stale).
7. `backend/models_api.py`, `backend/db.py`, `backend/deps.py` wired to fixture-mode adapters only.
8. `backend/routers/homepage.py` — first working `GET /homepage` returning real engine output from fixture data. **This is the first working vertical slice — test it with `curl` before touching the frontend.**

**Phase 3 — Frontend catches up in parallel with Phase 2 steps 7–8**
9. `frontend` skeleton, `lib/api.ts` + `lib/types.ts` written against the `07_...md` contract directly (not waiting for backend — can point at a local JSON mock server or MSW-style fixture responses until step 8 is live).
10. `app/page.tsx` + `CardList`/`Card`/`WarningBanner`/`SourceBadge` rendering real `/homepage` output once step 8 is done.

**Phase 4 — Explanation + preferences (the personalization payoff)**
11. `backend/routers/explain.py` + `ExplanationSheet.tsx`.
12. `backend/routers/preferences.py` + `preferences` table + `PersonaSelector.tsx` + `app/preferences/page.tsx`.
13. Verify live re-rank end-to-end (checkpoint in §11 below).

**Phase 5 — Real data + degradation**
14. `adapters/aqi_adapter.py` + `adapters/uv_adapter.py` in `live` mode (once credentials exist, per `HUMAN_RESEARCH_AND_ACCESS_CHECKLIST.md` items 1–3) — develop against `aqi_uv_recorded_samples.json` fixture first, swap to live last.
15. Degraded-state UI (`DegradedBanner`) + intentional feed-kill demo toggle.
16. Full demo rehearsal against `10_...md` §6 checklist.

---

## 9. Pair A Task Split (2 developers, minimal merge conflicts)

**Dev 1 — Engine + Backend + Adapters** (owns `/engine`, `/adapters`, `/cache`, `/backend`)
**Dev 2 — Frontend + Integration** (owns `/frontend`)

**Why this split, not a horizontal one:** the seam between them is exactly the `07_...md` contract, which is already frozen and written down — Dev 2 never needs to touch Python, and Dev 1 never needs to touch TypeScript/React, so there is close to zero file-level overlap. Compare to splitting "backend logic" vs. "backend API" — that would put both devs in `/backend` daily, guaranteeing merge conflicts.

**Dependencies between them:**
- Dev 2 is **not blocked** waiting for Dev 1: build `lib/api.ts`/`lib/types.ts` against the written contract (`07_...md`) and a local mock (JSON fixture responses, or a one-file mock Express/FastAPI stub if preferred) from hour one — per Phase 3 above.
- Integration point: once Dev 1's real `/homepage` (step 8) is live, Dev 2 swaps the mock base URL for the real one — this should be a one-line config change if `lib/api.ts` was written against the contract correctly, not a rewrite.
- Both devs should treat any *change* to `07_...md` mid-build as requiring a 2-minute sync before either side implements it — this is the one genuine coordination point, and it's small precisely because the contract is already fully specified.

**Integration checkpoints:** end of Phase 2 (first real `/homepage` response consumed by frontend), end of Phase 4 (explain + preferences wired end-to-end), end of Phase 5 (full demo rehearsal, both devs present).

---

## 10. Development Setup

**Backend/`engine`/`adapters`:**
```
Python 3.11+
pip install fastapi uvicorn[standard] pydantic sqlalchemy requests astral pytest httpx
```
`.env` (backend root, never committed):
```
ADAPTER_MODE=fixture
FIXTURE_SCENARIO=normal
AQI_DATA_GOV_IN_KEY=
AQI_AQICN_TOKEN=
OWM_API_KEY=
DATABASE_URL=sqlite:///./app.db
```
Run locally: `uvicorn backend.main:app --reload --port 8000`
Test: `pytest engine/tests backend/tests adapters/tests -v`

**Frontend:**
```
Node 18+
npm install next react react-dom typescript @tanstack/react-query tailwindcss lucide-react
```
`.env.local` (frontend root):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```
Run locally: `npm run dev` (default port 3000)
Test: `npm run test` (Vitest)

**Fixture strategy recap:** `ADAPTER_MODE=fixture` + `FIXTURE_SCENARIO=<name>` lets Dev 1 (and Dev 2, via mock responses) exercise all four demo scenarios (normal/rain/heat-UV/warning) without any external credentials, from day 1 — this is the mechanism that makes Phase 1–4 above fully unblocked by `HUMAN_RESEARCH_AND_ACCESS_CHECKLIST.md` items 1–3.

---

## 11. Testing Checkpoints

Directly reuses `10_testing_and_validation_plan.md` §1–2, restated as milestone gates:

| After milestone | Must prove |
|---|---|
| Phase 1 (engine done) | `pytest engine/tests` green; specifically: same `ContextFrame`, different `personas` → different top card (persona changes ranking); same `personas`, different `environment.aqi` → different priority (environment changes ranking independent of persona) — these are the two tests that directly disprove Risk R5 |
| Phase 2 (first `/homepage` slice) | `curl "localhost:8000/homepage?device_id=x&lat=18.5&lon=73.8"` twice, with `FIXTURE_SCENARIO=normal` then `FIXTURE_SCENARIO=severe_warning` → confirm `override_warnings` is empty in the first call and populated in the second, with the warning card first |
| Phase 4 (explain + preferences) | Change persona via `PUT /preferences`, re-fetch `/homepage`, diff the two JSON responses — card order must differ; open `/explain` for the top card and confirm `signal_refs[0].value` matches the number shown in `value_summary` on the corresponding card |
| Phase 5 (real data + degradation) | Force `AQIAdapter` into a failure (bad API key, or airplane-mode the test) → confirm response still returns 200 with `source: "unavailable"` or `"stale"` on the AQI card, never a 5xx, never a fabricated live-looking number |
| Full rehearsal | All 5 `10_...md` §6 demo-day checklist items pass live, not just in tests |

---

## 12. Antigravity / AI Coding Workflow

**Principle:** never ask an AI coding tool to generate the whole app, or even a whole layer, in one prompt. Feed it one module at a time, with the relevant spec section pasted in as context, review the diff, run the tests for that module, then move to the next prompt. Treat each prompt as one row of the build order in §8.

**First 8–12 prompts, in order:**

1. *"Create the repo skeleton for `sih26076-mausam` matching this exact folder structure: [paste §2 tree]. Empty `__init__.py` files where needed, `.gitignore` for Python+Node, `requirements.txt` and `package.json` with the packages listed in §10 of this blueprint. No logic yet."*
2. *"In `engine/models.py`, implement these exact dataclasses: [paste §3 `models.py` block]. No other code."*
3. *"In `engine/cards.py`, implement `CARD_DEFINITIONS` exactly as specified: [paste §3 `cards.py` block plus the full card table from `03_personalization_logic_and_decision_matrix.md` §3]."*
4. *"In `engine/scoring.py`, implement `score()`, `urgency_multiplier()`, `confidence_factor()`, and the `PERSONA_WEIGHT` table, following the rules in `03_personalization_logic_and_decision_matrix.md` §4 exactly — [paste §4 of that file]. Use the skeleton in this blueprint §3 as the starting shape and fill in the remaining card×persona weight pairs and urgency branches for every card in `CARD_DEFINITIONS`."*
5. *"In `engine/priority.py` and `engine/conflict.py`, implement priority classification, alert logic, and tie-break resolution per `03_...md` §5, §6, §8 — [paste those sections]."*
6. *"In `engine/explain.py`, implement templated explanation generation per `03_...md` §13 — explanations must only use values present in `signal_refs`/`score_components`, never freely generated text. [paste §13 and the two worked scenarios]."*
7. *"In `engine/engine.py`, implement the single public `rank(context_frame) -> EngineOutput` entrypoint per this blueprint's §3 orchestration sketch. It must not import anything from `adapters`, `backend`, `fastapi`, or `sqlite3`."*
8. *"Write `engine/tests/test_scoring.py`, `test_priority_override.py`, `test_cold_start.py`, `test_missing_data.py` covering exactly the checkpoints in this blueprint's §11 Phase-1 row. Use hand-built `ContextFrame` fixtures, no adapters."*
9. *"Implement `adapters/base.py`, `adapters/sun_adapter.py` (using the `astral` package), `adapters/forecast_adapter.py` and `adapters/warning_adapter.py` (fixture-backed, reading from `adapters/fixtures/*.json`, selected by the `FIXTURE_SCENARIO` env var). Create the four fixture JSON files with realistic IMD-shaped values for: normal day, rain/commute-impact day, heat/UV-spike day, severe-warning day."*
10. *"Implement `cache/store.py`: a SQLite-backed get/set/is_stale key-value store per the schema in this blueprint's §7 `signal_cache` table."*
11. *"Implement `backend/models_api.py` (Pydantic models mirroring `07_api_and_data_contracts.md` exactly — paste the file), `backend/db.py` (SQLite setup per §7's `preferences` table), and `backend/deps.py` wiring adapters+cache+engine together per this blueprint's §4 request-flow diagram."*
12. *"Implement `backend/routers/homepage.py` for `GET /homepage` per `07_...md` and this blueprint §4. Then write `backend/tests/test_homepage_contract.py` asserting the response shape matches `07_...md` exactly and that `FIXTURE_SCENARIO=severe_warning` produces a non-empty `warnings_override`."*

(Continue this same one-module-per-prompt pattern for `/explain`, `/preferences`, then the frontend components in §5, each prompt pasting the relevant spec section as context — do not skip ahead to "build the whole frontend" as a single prompt.)

**Review discipline:** after every generated module, run its test file before the next prompt. If a generated diff touches a file outside the prompt's stated scope (e.g., a `/backend` prompt edits something in `/engine`), reject it and re-prompt — this is the concrete enforcement of the module-boundary rule from `06_...md` §2, applied to the AI-assisted workflow specifically.

---

## DAY 1 START CHECKLIST

- [ ] Create the repository with the exact folder structure in §2 (Prompt 1 above).
- [ ] Dev 1: implement `engine/models.py` + `engine/cards.py` + `engine/scoring.py`/`priority.py`/`conflict.py`/`explain.py`/`engine.py`, and get all of `engine/tests/*` passing (Prompts 2–8) — target: done by end of day 1.
- [ ] Dev 2: scaffold `frontend` (Next.js + Tailwind + TanStack Query installed), write `lib/types.ts` directly from `07_api_and_data_contracts.md`, and stub `app/page.tsx` rendering a hardcoded sample `/homepage` JSON response so the card/warning-banner layout exists before any real backend call works.
- [ ] Either dev: register data.gov.in, aqicn.org, and OpenWeatherMap API accounts today (per `HUMAN_RESEARCH_AND_ACCESS_CHECKLIST.md` items 1–3) — this does not block Phase 1–4 build work, but the longer it's delayed, the more it risks Phase 5.
- [ ] Confirm with the rest of the 6-person team who owns filing the IMD API whitelisting request (checklist item 4) and who owns the `/eval` golden-set/spike work (`00_team_execution_dependencies.md`) — Pair A's build does not block on either, but both should be started today by whoever owns them.
- [ ] Add the `/engine` import-boundary pre-commit check (§2) before the first PR merges, not after.
- [ ] End of day 1 target: `engine/tests/*` green, `frontend` renders a static sample homepage layout — i.e., Phase 1 complete and Phase 3's first half started, per §8.
