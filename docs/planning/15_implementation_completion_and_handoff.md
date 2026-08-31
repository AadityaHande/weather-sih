# 15 — Implementation Completion & Final Handoff (Pair A)

This file does not redo `14_implementation_blueprint.md`. It cross-checks it against `13_final_mvp_specification.md`, `03_...md`, `06_...md`, `07_...md`, `08_...md`, `09_...md`, `10_...md`, `11_...md`, `00_team_execution_dependencies.md`, closes every gap `14_...md` left open (`...` placeholders, missing router code, missing deploy commands, missing full data tables), and adds the day-by-day handoff the previous file didn't have. No MVP, persona, architecture, or contract change is made anywhere below.

**No new technical contradiction found.** One additional implementation-freedom decision (not a contradiction — same class as `14_...md`'s `device_id`-in-body resolution) is made and flagged in §0.3 below, because leaving it unresolved would have blocked writing `scoring.py` completely.

---

## 0. What Is Already Complete vs. What This File Adds

### 0.1 Already fully complete (in `14_implementation_blueprint.md` — do not redo)
Tech stack lock, repo folder tree, `engine/models.py` dataclasses, `ContextFrame` validation function, `CARD_DEFINITIONS` registry, `priority.py` classifier, `conflict.py` tie-break, `engine.py` orchestration skeleton, backend endpoint list + request flow diagram, frontend component list + route mapping, adapter interface + fixture-mode switch, SQLite schema (`preferences`, `signal_cache`), Pair A task split (Dev 1 = engine/backend/adapters, Dev 2 = frontend), and the first 12 AI-coding prompts.

### 0.2 What was left incomplete (the actual gap — closed in this file)
1. `PERSONA_WEIGHT` table had only ~9 of 32 card×persona pairs filled, marked `# ... fill during build`.
2. `urgency_multiplier()` had only 2 of 8 cards' branches written, marked `# ... one branch per card`.
3. `explain.py` had only 1 of 8 explanation templates.
4. Five helper functions referenced in `engine.py` (`_card_applies`, `_primary_signal_for`, `_signal_refs_for`, `_best_persona_for_card`, `_declared_ids`) were named but never implemented.
5. `/explain` and `/preferences` routers were described in prose only — no code.
6. `backend/main.py` (CORS, startup wiring) did not exist at all — a real gap, since the frontend and backend will be deployed to different domains (Vercel + Render) and will fail silently on CORS if this is missed.
7. Deployment was described as "any simple host" with no actual commands.
8. No integration checklist existed between frontend and backend.
9. Build order was phase-based, not mapped to a 5-day calendar, and there was no single "exact first task."
10. No section stated what Pair A is still waiting on from the other 4 team members.

### 0.3 One implementation-freedom decision made here (not a contradiction)
`03_...md` §3's card table lists which personas each card is "relevant to," but §4–§11 and the worked scenarios in §"Example Scenarios" show **every applicable card appearing for every persona**, just at different priority (e.g., Scenario A's family user still sees the AQI card, at P2, not omitted). Read literally, this means persona relevance is expressed entirely through `persona_weight` (ranking), not through card inclusion/exclusion. **Resolved as:** all 8 cards are candidates for all 4 personas (health, fitness, family, default_general) whenever their underlying data is available; `PERSONA_WEIGHT` is therefore fully populated below for every pair, not left to a generic fallback. The one genuine exception is `pollen_illustrative`, which `03_...md` §3 explicitly marks "(only if enabled)" — that one card is gated on an explicit opt-in, not just weighted low, per §0.4 below.

---

## 1. Complete `engine/scoring.py` (all placeholders filled)

```python
# engine/scoring.py
from .models import ContextFrame, SignalValue

# Full 8-card × 4-persona table. Every value here is a DESIGN placeholder per
# Flag 7 in 00_consistency_check_and_flags.md — sanity-check against eval/run_spike.py
# output before treating any of these as final/tuned.
PERSONA_WEIGHT = {
    # severe_warning: weight is never actually used for ranking (P0 hard-rule bypasses
    # scoring entirely, per 03_...md §5) — kept at 1.0 for all personas only so
    # explanation_text/score_components are never null for this card.
    ("severe_warning", "health"): 1.0,
    ("severe_warning", "fitness"): 1.0,
    ("severe_warning", "family"): 1.0,
    ("severe_warning", "default_general"): 1.0,

    ("aqi_health", "health"): 0.9,
    ("aqi_health", "fitness"): 0.5,
    ("aqi_health", "family"): 0.4,
    ("aqi_health", "default_general"): 0.6,

    ("uv_sun_exposure", "health"): 0.6,
    ("uv_sun_exposure", "fitness"): 0.9,
    ("uv_sun_exposure", "family"): 0.3,
    ("uv_sun_exposure", "default_general"): 0.4,

    ("activity_window", "health"): 0.3,
    ("activity_window", "fitness"): 0.95,
    ("activity_window", "family"): 0.25,
    ("activity_window", "default_general"): 0.3,

    ("rain_commute", "health"): 0.3,
    ("rain_commute", "fitness"): 0.6,
    ("rain_commute", "family"): 0.95,
    ("rain_commute", "default_general"): 0.4,

    ("sunrise_sunset", "health"): 0.3,
    ("sunrise_sunset", "fitness"): 0.5,
    ("sunrise_sunset", "family"): 0.3,
    ("sunrise_sunset", "default_general"): 0.3,

    ("general_conditions", "health"): 0.5,
    ("general_conditions", "fitness"): 0.5,
    ("general_conditions", "family"): 0.5,
    ("general_conditions", "default_general"): 0.7,

    # pollen_illustrative is opt-in gated in _card_applies() (engine.py), never alertable
    # (CARD_DEFINITIONS["pollen_illustrative"]["alertable"] = False) — weight only matters
    # for the health persona, since that's the only persona that can ever see this card.
    ("pollen_illustrative", "health"): 0.4,
    ("pollen_illustrative", "fitness"): 0.0,
    ("pollen_illustrative", "family"): 0.0,
    ("pollen_illustrative", "default_general"): 0.0,
}

# Cold-start ordering check (03_...md §11): with baseline urgency=1.0, confidence=1.0,
# default_general weights give severe_warning(P0) > general_conditions(0.7) >
# aqi_health(0.6) > uv_sun_exposure(0.4) > sunrise_sunset(0.3) — matches the spec exactly.


def urgency_multiplier(card_id: str, cf: ContextFrame) -> float:
    """Pure function of environment values only — never persona. This independence is
    what 03_...md §4 relies on to prove personalization isn't just a lookup table."""

    if card_id == "severe_warning":
        return 1.0  # irrelevant: P0 hard-rule bypasses scoring entirely

    if card_id == "aqi_health":
        v = cf.aqi.value["aqi"] if isinstance(cf.aqi.value, dict) else cf.aqi.value
        if v is None:
            return 1.0
        if v >= 300:
            return 2.5
        if v >= 150:
            return 1.8
        if v >= 100:
            return 1.3
        return 1.0

    if card_id == "uv_sun_exposure":
        v = cf.uv.value
        if v is None:
            return 1.0
        if v >= 11:
            return 2.2
        if v >= 8:
            return 1.8
        if v >= 6:
            return 1.2
        return 1.0

    if card_id == "activity_window":
        # Composite: conditions that make "when should I go outside" urgent —
        # bad AQI, high UV, extreme temp, or high wind all push this card up,
        # regardless of persona (Scenario B's 1pm UV-spike is the canonical case).
        aqi_v = cf.aqi.value["aqi"] if isinstance(cf.aqi.value, dict) else cf.aqi.value
        uv_v = cf.uv.value
        temp_v = cf.temp_c.value
        wind_v = cf.wind_kmh.value
        bad = (
            (aqi_v is not None and aqi_v >= 150)
            or (uv_v is not None and uv_v >= 8)
            or (temp_v is not None and (temp_v >= 38 or temp_v <= 5))
            or (wind_v is not None and wind_v >= 40)
        )
        moderate = (
            (aqi_v is not None and aqi_v >= 100)
            or (uv_v is not None and uv_v >= 6)
        )
        if bad:
            return 1.8
        if moderate:
            return 1.3
        return 1.0

    if card_id == "rain_commute":
        p = cf.precip_prob_pct.value
        if p is None:
            return 1.0
        if cf.is_commute_window and p >= 60:
            return 2.0
        if cf.is_commute_window and p >= 30:
            return 1.5
        if p >= 60:
            return 1.3
        return 1.0

    if card_id == "sunrise_sunset":
        return 1.0  # informational; never independently urgent in the MVP

    if card_id == "general_conditions":
        v = cf.temp_c.value
        if v is not None and (v >= 40 or v <= 5):
            return 1.3  # heatwave/coldwave-adjacent, even with no dedicated warning card
        return 1.0

    if card_id == "pollen_illustrative":
        return 1.0  # simulated/illustrative only, per 13_...md — never independently alerted

    return 1.0


CONFIDENCE_BY_SOURCE = {"live": 1.0, "cached": 0.9, "simulated": 0.7, "stale": 0.3, "unavailable": 0.0}


def confidence_factor(signal: SignalValue) -> float:
    return CONFIDENCE_BY_SOURCE[signal.source]


def score(card_id: str, persona: str, cf: ContextFrame, primary_signal: SignalValue) -> tuple[float, dict]:
    pw = PERSONA_WEIGHT.get((card_id, persona), 0.2)
    um = urgency_multiplier(card_id, cf)
    cfac = confidence_factor(primary_signal)
    return pw * um * cfac, {"persona_weight": pw, "urgency_multiplier": um, "confidence_factor": cfac}
```

---

## 2. Complete `engine/explain.py` (all 8 templates)

```python
# engine/explain.py
from .models import ContextFrame

EXPLANATION_TEMPLATES = {
    "severe_warning": "{warning_text} — active {severity} warning → always shown first, regardless of your persona or preferences.",
    "aqi_health": "AQI {aqi_value} ({aqi_band}) — {urgency}x above the normal threshold{persona_clause} → shown as {priority_label}.",
    "uv_sun_exposure": "UV index {uv_value} ({uv_band}) — {urgency}x above the normal threshold{persona_clause} → shown as {priority_label}.",
    "activity_window": "Based on temp {temp_value}°C, wind {wind_value} km/h, AQI {aqi_value}, and UV {uv_value}, the best outdoor window has shifted{persona_clause} → shown as {priority_label}.",
    "rain_commute": "{precip_value}% chance of rain{commute_clause} → shown as {priority_label}.",
    "sunrise_sunset": "Sunrise {sunrise_value}, sunset {sunset_value} → shown as {priority_label}.",
    "general_conditions": "Currently {temp_value}°C, {humidity_value}% humidity, wind {wind_value} km/h → shown as {priority_label}.",
    "pollen_illustrative": "Pollen level shown as {pollen_value} [simulated for demo, illustrative only] → shown as {priority_label}.",
}

PRIORITY_LABEL = {"P0": "an override warning", "P1": "a high-priority alert",
                   "P2": "a normal-priority item", "P3": "a low-priority/background item"}


def _band(card_id: str, value) -> str:
    if value is None:
        return "unknown"
    if card_id == "aqi_health":
        if value >= 300: return "Severe"
        if value >= 150: return "Poor"
        if value >= 100: return "Moderate"
        return "Satisfactory"
    if card_id == "uv_sun_exposure":
        if value >= 11: return "Extreme"
        if value >= 8: return "Very High"
        if value >= 6: return "High"
        return "Moderate/Low"
    return ""


def build_explanation(card_id: str, priority: str, score_components: dict,
                       signal_refs: list[dict], cf: ContextFrame) -> str:
    """Templated only — never freely generated / never LLM-dependent, per 03_...md §13
    and Flag 10 in 00_consistency_check_and_flags.md (NFR-1 must hold even if an optional
    LLM phrasing layer is cut for time)."""
    template = EXPLANATION_TEMPLATES[card_id]
    priority_label = PRIORITY_LABEL[priority]
    urgency = score_components.get("urgency_multiplier", 1.0)
    persona_weight = score_components.get("persona_weight", 0.0)
    persona_clause = ", and this matters more for your declared persona" if (
        cf.has_declared_profile and persona_weight >= 0.6) else ""

    refs = {r["signal"]: r["value"] for r in signal_refs}

    if card_id == "severe_warning":
        w = cf.warnings[0] if cf.warnings else {"type": "warning", "severity": "severe", "text": "Severe weather warning"}
        return template.format(warning_text=w.get("text", "Severe weather warning"),
                                severity=w.get("severity", "severe"))
    if card_id == "aqi_health":
        v = refs.get("aqi")
        return template.format(aqi_value=v, aqi_band=_band("aqi_health", v),
                                urgency=urgency, persona_clause=persona_clause, priority_label=priority_label)
    if card_id == "uv_sun_exposure":
        v = refs.get("uv")
        return template.format(uv_value=v, uv_band=_band("uv_sun_exposure", v),
                                urgency=urgency, persona_clause=persona_clause, priority_label=priority_label)
    if card_id == "activity_window":
        return template.format(temp_value=refs.get("temp_c"), wind_value=refs.get("wind_kmh"),
                                aqi_value=refs.get("aqi"), uv_value=refs.get("uv"),
                                persona_clause=persona_clause, priority_label=priority_label)
    if card_id == "rain_commute":
        commute_clause = " within your commute window" if cf.is_commute_window else ""
        return template.format(precip_value=refs.get("precip_prob_pct"),
                                commute_clause=commute_clause, priority_label=priority_label)
    if card_id == "sunrise_sunset":
        return template.format(sunrise_value=cf.sunrise, sunset_value=cf.sunset, priority_label=priority_label)
    if card_id == "general_conditions":
        return template.format(temp_value=refs.get("temp_c"), humidity_value=refs.get("humidity_pct"),
                                wind_value=refs.get("wind_kmh"), priority_label=priority_label)
    if card_id == "pollen_illustrative":
        return template.format(pollen_value=refs.get("pollen"), priority_label=priority_label)

    return f"Shown as {priority_label}."
```

---

## 3. The Five Missing Helper Functions (`engine/engine.py`, completed)

```python
# engine/engine.py (additions — goes alongside the rank() orchestration already in 14_...md §3)
from .cards import CARD_DEFINITIONS
from .models import ContextFrame, SignalValue

PERSONAS_ALL = {"health", "fitness", "family", "default_general"}


def _card_applies(card_id: str, cf: ContextFrame) -> bool:
    """Missing-data + opt-in gating, per 03_...md §10 and the §0.3 resolution above."""
    if card_id == "pollen_illustrative":
        # Gated: only ever shown if the user declared the health persona AND
        # explicitly opted in via a health flag. This is the one card that is
        # excluded outright rather than just down-weighted (per 03_...md §3 "(only if enabled)").
        return "health" in cf.personas and "pollen_interest" in cf.health_flags and cf.pollen is not None

    if card_id == "aqi_health":
        return cf.aqi.source != "unavailable"
    if card_id == "uv_sun_exposure":
        return cf.uv.source != "unavailable"
    if card_id == "rain_commute":
        return cf.precip_prob_pct.source != "unavailable"
    if card_id == "sunrise_sunset":
        return True  # locally computed, cannot be unavailable (08_...md §2)
    if card_id == "general_conditions":
        # Safe fallback card — omitted only if ALL of its inputs are unavailable
        # (03_...md §10(a): omit only if no safe default exists at all).
        return not (cf.temp_c.source == "unavailable" and cf.humidity_pct.source == "unavailable"
                    and cf.wind_kmh.source == "unavailable")
    if card_id == "activity_window":
        sigs = [cf.temp_c, cf.wind_kmh, cf.aqi, cf.uv]
        return any(s.source != "unavailable" for s in sigs)
    if card_id == "severe_warning":
        return len(cf.warnings) > 0
    return True


def _primary_signal_for(card_id: str, cf: ContextFrame) -> SignalValue:
    """Which single SignalValue's confidence gates this card's score (03_...md §4)."""
    if card_id == "aqi_health":
        return cf.aqi
    if card_id == "uv_sun_exposure":
        return cf.uv
    if card_id == "rain_commute":
        return cf.precip_prob_pct
    if card_id == "pollen_illustrative":
        return cf.pollen
    if card_id == "sunrise_sunset":
        return SignalValue(value=f"{cf.sunrise}/{cf.sunset}", source="live", freshness_min=0, confidence=1.0)
    if card_id == "severe_warning":
        # Alerts are never suppressed by low confidence (03_...md §6) — always trusted,
        # but its source still reflects that MVP warnings are simulated (13_...md).
        return SignalValue(value=cf.warnings, source="simulated", freshness_min=0, confidence=1.0)
    if card_id in ("activity_window", "general_conditions"):
        # Composite cards: confidence is gated by the WEAKEST input signal in the group,
        # so a partially-degraded composite card visibly reflects that degradation.
        group = [cf.temp_c, cf.wind_kmh] + ([cf.aqi, cf.uv] if card_id == "activity_window" else [cf.humidity_pct])
        valid = [s for s in group if s.source != "unavailable"]
        return min(valid, key=lambda s: s.confidence) if valid else group[0]
    return cf.temp_c


def _signal_refs_for(card_id: str, cf: ContextFrame) -> list[dict]:
    """Every value an explanation for this card is allowed to reference — this list IS
    the checkable evidence behind NFR-1 (07_...md §5 invariant, 10_...md §7)."""
    def ref(name, sig: SignalValue, extract=lambda v: v):
        return {"signal": name, "value": extract(sig.value), "source": sig.source}

    if card_id == "aqi_health":
        return [ref("aqi", cf.aqi, lambda v: v["aqi"] if isinstance(v, dict) else v)]
    if card_id == "uv_sun_exposure":
        return [ref("uv", cf.uv)]
    if card_id == "activity_window":
        return [ref("temp_c", cf.temp_c), ref("wind_kmh", cf.wind_kmh),
                ref("aqi", cf.aqi, lambda v: v["aqi"] if isinstance(v, dict) else v), ref("uv", cf.uv)]
    if card_id == "rain_commute":
        return [ref("precip_prob_pct", cf.precip_prob_pct)]
    if card_id == "sunrise_sunset":
        return [{"signal": "sunrise", "value": cf.sunrise, "source": "live"},
                {"signal": "sunset", "value": cf.sunset, "source": "live"}]
    if card_id == "general_conditions":
        return [ref("temp_c", cf.temp_c), ref("humidity_pct", cf.humidity_pct), ref("wind_kmh", cf.wind_kmh)]
    if card_id == "pollen_illustrative":
        return [ref("pollen", cf.pollen)]
    if card_id == "severe_warning":
        return [{"signal": "warning", "value": w, "source": "simulated"} for w in cf.warnings]
    return []


def _best_persona_for_card(card_id: str, personas: list[str]) -> str:
    """When a user has multiple declared personas (09_...md §1 S4 allows multi-select),
    use whichever gives this specific card the HIGHEST weight — a health+fitness parent
    should still see the AQI card scored at the health weight, not diluted."""
    from .scoring import PERSONA_WEIGHT
    candidates = personas if personas else ["default_general"]
    return max(candidates, key=lambda p: PERSONA_WEIGHT.get((card_id, p), 0.2))


def _declared_ids(cf: ContextFrame) -> set[str]:
    """Card ids 'tied to a declared (not default) persona signal' — used only for the
    conflict.py tie-break rule 3 (03_...md §8). Empty for cold-start users by definition."""
    if not cf.has_declared_profile:
        return set()
    declared = set()
    for card_id, definition in CARD_DEFINITIONS.items():
        relevant = definition.get("personas", [])
        if "*" in relevant:
            continue  # not a distinguishing signal for tie-breaking
        if any(p in relevant for p in cf.personas):
            declared.add(card_id)
    return declared
```

---

## 4. Complete Backend Routers (code, not prose)

```python
# backend/explanation_cache.py — short-TTL, in-process, per §4/§7 of 14_...md
import time
_STORE: dict[str, tuple[float, dict]] = {}
TTL_SECONDS = 600

def put(explanation_ref: str, payload: dict) -> None:
    _STORE[explanation_ref] = (time.time(), payload)

def get(explanation_ref: str) -> dict | None:
    entry = _STORE.get(explanation_ref)
    if not entry:
        return None
    ts, payload = entry
    if time.time() - ts > TTL_SECONDS:
        del _STORE[explanation_ref]
        return None
    return payload
```

```python
# backend/routers/explain.py
from fastapi import APIRouter, HTTPException, Query
from backend import explanation_cache

router = APIRouter()

@router.get("/explain")
def get_explanation(explanation_ref: str = Query(...)):
    entry = explanation_cache.get(explanation_ref)
    if entry is None:
        raise HTTPException(status_code=404, detail="explanation_ref not found or expired")
    return {
        "explanation_ref": explanation_ref,
        "text": entry["text"],
        "signal_refs": entry["signal_refs"],
        "score_components": entry["score_components"],
    }
```

```python
# backend/routers/preferences.py
import json, datetime
from fastapi import APIRouter
from pydantic import BaseModel
from backend.db import get_connection

router = APIRouter()

class PreferencesBody(BaseModel):
    device_id: str
    personas: list[str] = []
    health_flags: list[str] = []
    saved_locations: list[dict] = []

@router.get("/preferences")
def read_preferences(device_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM preferences WHERE device_id=?", (device_id,)).fetchone()
    if row is None:
        return {"device_id": device_id, "personas": ["default_general"], "health_flags": [], "saved_locations": []}
    return {
        "device_id": row["device_id"],
        "personas": json.loads(row["personas"]),
        "health_flags": json.loads(row["health_flags"]),
        "saved_locations": json.loads(row["saved_locations"] or "[]"),
    }

@router.put("/preferences")
def write_preferences(body: PreferencesBody):
    conn = get_connection()
    conn.execute(
        """INSERT INTO preferences (device_id, personas, health_flags, saved_locations, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(device_id) DO UPDATE SET
             personas=excluded.personas, health_flags=excluded.health_flags,
             saved_locations=excluded.saved_locations, updated_at=excluded.updated_at""",
        (body.device_id, json.dumps(body.personas), json.dumps(body.health_flags),
         json.dumps(body.saved_locations), datetime.datetime.utcnow().isoformat()),
    )
    conn.commit()
    return {"status": "ok"}
```

> **PARTIALLY SUPERSEDED — see `16_production_architecture_reassessment.md` §4.3/§5.2.** The hardcoded `allow_origins` list below should be read from a `CORS_ALLOWED_ORIGINS` env var instead (so a Vercel URL change is a dashboard edit, not a code change), and a `/health` endpoint should be added. The router-mounting and startup-wiring shape below is otherwise unchanged.

```python
# backend/main.py — the missing wiring (CORS was not specified anywhere in 14_...md;
# it WILL cause a silent failure once frontend/backend are on different domains).
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import homepage, explain, preferences
from backend.db import init_db

app = FastAPI(title="Mausam Personalized Homepage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://<your-vercel-app>.vercel.app",  # replace after first Vercel deploy, §6 below
        # SUPERSEDED: read this list from CORS_ALLOWED_ORIGINS env var instead — see 16_...md §5.2
    ],
    allow_methods=["GET", "PUT"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup():
    init_db()

app.include_router(homepage.router)
app.include_router(explain.router)
app.include_router(preferences.router)
# Add GET /health here per 16_...md §4.3 — checks DB connectivity, backs the pre-demo warm-up.
```

> **SUPERSEDED — see `16_production_architecture_reassessment.md` §1.3.** The SQLite version below does not persist on a deployed Render instance (ephemeral filesystem). The deployed backend uses `psycopg` against Neon Postgres with the same table names/shapes and the same `get_connection()`/`init_db()` function names — only the driver and placeholder syntax (`?` → `%s`) change. Kept below for local-dev/testing reference only.

```python
# backend/db.py — LOCAL/TEST REFERENCE ONLY, not the deployed persistence layer
import sqlite3

DB_PATH = "app.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    conn.execute("""CREATE TABLE IF NOT EXISTS preferences (
        device_id TEXT PRIMARY KEY,
        personas TEXT NOT NULL,
        health_flags TEXT NOT NULL,
        saved_locations TEXT,
        updated_at TEXT NOT NULL
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS signal_cache (
        cache_key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        source TEXT NOT NULL,
        fetched_at TEXT NOT NULL
    )""")
    conn.commit()
    conn.close()
```

`backend/routers/homepage.py` is exactly what `14_...md` §4 already specified in prose (load prefs → `build_context_frame()` → `engine.rank()` → map to JSON → `explanation_cache.put()` for every card's `explanation_ref` before returning). No new decision needed there — only the two routers above and `main.py`/`db.py` were actually missing code.

---

## 5. Exact Environment Files

> **SUPERSEDED — see `16_production_architecture_reassessment.md` §1.3/§5.1.** `DATABASE_URL` below should be a Neon pooled Postgres connection string in the deployed environment, not the SQLite path shown. `CORS_ALLOWED_ORIGINS` is correct as shown and is now actually read by `main.py` (§4.3/§5.2 of `16_...md`), rather than being an unused placeholder.

```bash
# backend/.env.example  (copy to backend/.env, never commit the real one)
ADAPTER_MODE=fixture
FIXTURE_SCENARIO=normal
AQI_DATA_GOV_IN_KEY=
AQI_AQICN_TOKEN=
OWM_API_KEY=
DATABASE_URL=postgresql://<user>:<password>@<neon-pooled-host>/<db>?sslmode=require   # Neon pooled connection string — see 16_...md §1.3
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

```bash
# frontend/.env.local.example  (copy to frontend/.env.local)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

```txt
# requirements.txt
fastapi==0.115.*
uvicorn[standard]==0.32.*
pydantic==2.9.*
requests==2.32.*
astral==3.2
pytest==8.3.*
httpx==0.27.*
python-dotenv==1.0.*
psycopg[binary,pool]==3.2.*   # added — Neon Postgres driver, see 16_...md §1.3 (replaces stdlib sqlite3)
```

```json
// package.json (frontend) — dependencies block
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tanstack/react-query": "^5.59.0",
    "lucide-react": "^0.383.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/node": "^22.7.0"
  }
}
```

---

## 6. Exact Deployment Steps

### 6.1 Backend → Render (Railway steps are the same shape, different dashboard)
1. Push the repo to GitHub (`main` branch, per `11_...md` §2 branch rule).
2. Render dashboard → **New → Web Service** → connect the GitHub repo.
3. **Root directory:** repo root (not `/backend`) so `backend.main:app` resolves as a package import.
4. **Build command:** `pip install -r requirements.txt`
5. **Start command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables in the Render dashboard exactly matching `backend/.env.example` (§5) — do **not** upload the `.env` file itself.
7. Deploy. Copy the resulting URL (e.g. `https://sih26076-backend.onrender.com`).
8. **SUPERSEDED — see `16_production_architecture_reassessment.md` §1/§7.** Persistence now lives in Neon Postgres (§1.3 of `16_...md`), not on Render's disk, so this is no longer a concern at all: preferences survive redeploys, restarts, and free-tier spin-downs.
9. Render free tier cold-starts after inactivity — **curl the deployed URL a few times 10–15 minutes before going on stage** to warm it up; this is a rehearsed step, not optional (same principle as `08_...md` §5's pre-cached demo location).

### 6.2 Frontend → Vercel
1. Vercel dashboard → **Add New → Project** → import the same GitHub repo.
2. **Root directory:** `frontend/`.
3. Framework preset: Next.js (auto-detected).
4. Add environment variable `NEXT_PUBLIC_API_BASE_URL` = the Render URL from §6.1 step 7.
5. Deploy. Copy the resulting URL (e.g. `https://sih26076-mausam.vercel.app`).
6. Go back to `backend/main.py`'s `allow_origins` list (§4), replace the placeholder with this real Vercel URL, commit, and let Render auto-redeploy — **CORS will otherwise silently block every request from the deployed frontend**, and this is the single most common "works on localhost, broken on stage" hackathon failure.

### 6.3 Local-only fallback build (per `11_...md` §5, made concrete)
Before demo day, run once with `ADAPTER_MODE=fixture` and no network calls (turn off wifi on the laptop running the backend) and confirm the app still fully renders. This is the literal last-resort path if venue connectivity fails — test it, don't assume it.

---

## 7. Frontend ↔ Backend Integration Checklist

- [ ] `frontend/lib/types.ts` field names match `07_api_and_data_contracts.md` exactly (`card_id`, `value_summary`, `freshness_badge`, `explanation_ref`, etc.) — no renaming for TS style.
- [ ] CORS `allow_origins` on the deployed backend includes the exact deployed Vercel URL (§6.2 step 6) — check this after every Vercel redeploy, since Vercel can assign preview URLs that differ from the production URL.
- [ ] `device_id` is generated once (`lib/deviceId.ts`, UUID v4), persisted in `localStorage`, and sent identically on every request in a session — verify by inspecting two consecutive `/homepage` calls in devtools.
- [ ] `lat`/`lon` are sent as numbers, not strings, in the query string.
- [ ] A full `/explain` round-trip works: tap a card → `explanation_ref` resolves → `signal_refs[0].value` matches the number shown in that card's `value_summary` (this is the literal NFR-1 check, not just a unit test).
- [ ] Changing persona in `PersonaSelector` → `PUT /preferences` returns 200 → `/homepage` refetch happens automatically (TanStack Query invalidation) → card order visibly changes within one interaction, no manual page refresh.
- [ ] `NEXT_PUBLIC_API_BASE_URL` on the deployed Vercel project points at the deployed Render URL, not `localhost` (a very common leftover from local dev).
- [ ] Cold-start path: clear `localStorage` (or open an incognito window) against the deployed URL → homepage still renders non-empty with zero configuration.
- [ ] Force one adapter into `unavailable` (temporarily break `OWM_API_KEY` in Render's env vars) → confirm the degraded badge renders end-to-end on the **deployed** app, not just in a backend unit test — this must be checked against the real deployed pair, not only locally.

---

## 8. Testing Order (exact sequence to run, and when)

1. `pytest engine/tests -v` — must be 100% green before writing a single adapter. This is Phase 1's exit gate.
2. `pytest adapters/tests -v` — fixture-mode only at this point (no credentials needed).
3. `pytest backend/tests -v` — contract tests against the fixture-mode backend (`FIXTURE_SCENARIO=normal` and `=severe_warning` cases, per `14_...md` §11).
4. Manual smoke test with `curl` against local `GET /homepage`, `GET /explain`, `GET`/`PUT /preferences` — confirms the server actually boots and routes are mounted, before frontend integration begins.
5. `npm run test` (Vitest) — component-level: `Card` renders correct visual weight per `priority`, `WarningBanner` never scrolls with the list, `SourceBadge` renders every `source` value without crashing.
6. Manual local end-to-end pass: both servers running locally, walk through S1→S2→S3→S4→S5 by hand once.
7. Switch `ADAPTER_MODE=live` (once AQI/UV credentials exist, §9 below) → re-run the AQI/UV-specific subset of `adapters/tests` against the real APIs, plus one more manual `curl`.
8. Full `10_testing_and_validation_plan.md` §6 demo-day checklist — run this last, and run it against the **deployed** URLs, not localhost, at least once before demo day.

---

## 9. Build Order, Day 1 – Day 5

**Day 1**
- Both devs together (first 1–2 hrs): create the repo skeleton exactly per `14_...md` §2, add the `/engine` import-boundary pre-commit hook.
- Dev 1: build all of `engine/` (§1–3 of this file plus `14_...md` §3) and get `pytest engine/tests -v` fully green.
- Dev 2: scaffold `frontend/` (Next.js + Tailwind + TanStack Query installed per §5's `package.json`), write `lib/types.ts` directly from `07_...md`, build `app/page.tsx` rendering one hardcoded sample `/homepage` JSON so the card/warning-banner layout exists visually.
- End of day: `engine/tests` green; static mock homepage renders in the browser.

**Day 2**
- Dev 1: `adapters/sun_adapter.py`, `adapters/forecast_adapter.py`, `adapters/warning_adapter.py` + the 4 fixture JSON files; `cache/store.py`; `backend/models_api.py`, `backend/db.py` (§4), `backend/deps.py`; `backend/routers/homepage.py` wired to fixture-mode adapters + the now-complete engine. Confirm with `curl` — first real vertical slice.
- Dev 2: `lib/api.ts` (typed fetchers against `07_...md`), `lib/deviceId.ts`, `CardList`/`Card`/`WarningBanner`/`SourceBadge` components built against the mock JSON (not blocked on Dev 1).
- End of day: real `GET /homepage` returns actual engine output via `curl`; frontend components exist and are ready to point at the real endpoint.

**Day 3**
- Dev 1: `backend/explanation_cache.py` + `backend/routers/explain.py` (§4); `preferences` table + `backend/routers/preferences.py` (§4); `backend/main.py` wiring + CORS (§4).
- Dev 2: swap `app/page.tsx` from the mock JSON to the real `/homepage` call; build `ExplanationSheet.tsx` + `PersonaSelector.tsx` + `app/preferences/page.tsx`; wire TanStack Query cache invalidation so persona changes trigger an immediate re-fetch/re-render.
- End of day: full local loop works end-to-end on fixture data — persona switch visibly reorders cards live (`13_...md` acceptance criterion 1, demoable on fixtures alone).

**Day 4**
- Dev 1: wire `adapters/aqi_adapter.py` / `adapters/uv_adapter.py` into `live` mode as soon as credentials arrive from the teammate handling registration (§10 below); if credentials are late, keep developing against `aqi_uv_recorded_samples.json` and do not block on this.
- Dev 2: `DegradedBanner.tsx` + an intentional feed-kill toggle for the demo; re-rank animation polish (`09_...md` §3).
- Both: run the full test sequence in §8 steps 1–6; begin deployment (§6) — Render backend first, then Vercel frontend, then fix CORS with the real Vercel URL.
- End of day: deployed URLs both live and talking to each other (§7 checklist mostly green).

**Day 5**
- Both: run the full `10_...md` §6 demo-day checklist against the **deployed** app at least twice.
- Pre-fetch and cache the actual demo location's live AQI/UV the night before (`08_...md` §5).
- Rehearse the local-only fallback build (§6.3) once, for real, not as an assumption.
- Deprioritize any remaining visual polish — functional S1–S5 correctness and the 5 acceptance criteria in `13_...md` take precedence over styling, per `09_...md` §5.

---

## 10. Exact First Coding Task

> Create the repository skeleton exactly matching the folder tree in `14_implementation_blueprint.md` §2 — empty `__init__.py` files where needed, `.gitignore` for Python+Node, `requirements.txt` (§5 of this file), `package.json` (§5 of this file), and the `/engine` import-boundary pre-commit hook (a one-line `grep -r "^import fastapi\|^import requests\|^import sqlite3" engine/*.py` check that fails if it matches anything). No application logic yet. This is the single task to hand an AI coding tool first, per `14_...md` §12 Prompt 1.

This is deliberately the *only* thing to do before any logic is written — it is unambiguous, has no design decisions left in it, and both devs can verify it by eye in under a minute.

---

## 11. What Pair A Should Do Next (today, in order)

1. Run the exact first coding task (§10) right now — do not start writing engine logic before the skeleton + boundary hook exist.
2. Assign Dev 1 / Dev 2 roles per the split in `14_...md` §9 (engine+backend+adapters vs. frontend) — this should be a 2-minute conversation, not a debate, since the split is designed around the `07_...md` contract seam specifically to avoid overlap.
3. Dev 1 starts `engine/` immediately using §1–3 of this file (fully filled in — no more placeholders to resolve).
4. Dev 2 starts the frontend skeleton + mock page immediately, in parallel, per Day 1 above.
5. Either dev (or whoever on the team owns it) should kick off AQI/UV/OpenWeatherMap credential registration **today**, even though Pair A's own build is not blocked on it until Day 4 — the longer this waits, the more it risks Phase 5, per `08_...md` §5 and `00_team_execution_dependencies.md`.
6. Message the `/eval` owner (see §12 below) once `engine/engine.py`'s `rank()` signature is locked at the end of Day 1 — the feasibility spike (`04_...md`) can start on Day 2 and does not need to wait for backend or frontend.

---

## 12. What Inputs Pair A Still Needs From the Other Team Members

| From whom | What's needed | By when | Why it matters to Pair A |
|---|---|---|---|
| Whoever owns `/eval` (golden set) | The actual authored `golden_set.json` (20–30 scenarios) per `05_evaluation_dataset_and_annotation_plan.md` | Day 2–3 | Pair A's own `engine/tests/*` use hand-built fixtures (§1–3 above are sufficient for that); the golden set is a separate regression suite per `10_...md` §2 that Pair A should wire in once received, not author itself |
| Whoever runs the feasibility spike (`04_...md`) | Nothing owed *to* Pair A — but Pair A should proactively hand over `engine.rank()`'s locked interface at end of Day 1 | End of Day 1 | The spike (Engine vs. Baseline A/B) can and should start Day 2, independent of backend/frontend progress, per `00_team_execution_dependencies.md`'s dependency chain |
| Whoever owns AQI/UV/OpenWeatherMap credential registration (`HUMAN_RESEARCH_AND_ACCESS_CHECKLIST.md` items 1–3) | Working API key(s) + one saved real sample JSON response per source | Day 3–4 | Without this, Phase 5 (live-mode `aqi_adapter`/`uv_adapter`) cannot be tested against real data before demo day; Pair A can keep building against fixtures in the meantime, so this does not block Days 1–3 |
| Whoever tracks IMD whitelisting / INCOIS status (checklist items 4–5) | Current status only (submitted / pending / resolved) | Day 4 | Not a build blocker — the simulated adapter is the MVP path by design (Decision D3) — but Pair A needs the current status to keep the "Known Limitations" framing in the live demo narrative accurate |
| Whoever owns the demo/judging narrative (`12_demo_and_judging_narrative.md`) | Final confirmed demo location(s) and confirmation that the 4 fixture scenarios (normal / rain-commute / heat-UV-spike / severe-warning) match what will actually be narrated on stage | Day 4–5, before fixture freeze | Pair A authors the fixture JSON content (Day 2); if the on-stage narrative expects specific numbers (e.g., a specific AQI value called out verbally), those numbers need to match the fixtures exactly, or the live `/explain` demo beat will contradict the spoken script |
