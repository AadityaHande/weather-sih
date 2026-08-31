# 00 — Project Decision Log

Format: Decision | Alternatives considered | Evidence basis | Reversibility

---

### D1 — Central product thesis
**Decision:** The homepage is powered by a transparent contextual **relevance & priority engine** (score/rank candidate cards + attach explanations), not a static persona switch and not a black-box ML/LLM recommender.
**Alternatives considered:** (A) Static persona templates, (B) pure rule-based if/else, (C) weighted contextual scoring, (D) hybrid rules+scoring, (E) ML/learned recommender, (F) advanced future architecture.
**Evidence basis:** PS explicitly rejects (A) as insufficient; commercial landscape shows (E)-flavoured LLM tip-generation is already commoditized and unsuitable for a government safety surface (no auditability); CARS/cold-start literature endorses rule/hybrid approaches as legitimate, not inferior, for this data regime; no usable interaction dataset exists for real ML. See `02_novelty_and_competitive_landscape.md`, `SIH26076_Deep_Research_Dossier.md` §4, §6.
**Reversibility:** High — engine is modular; a learned ranker can later replace or augment the scoring function without changing the card/explanation contract (see `13_final_mvp_specification.md` upgrade path).

### D2 — Architecture pattern
**Decision:** Adopt (D) hybrid rules + weighted contextual scoring as the MVP engine: hard rules for safety-critical overrides (e.g., severe weather warning always tops the stack), weighted scoring for everything else (persona relevance × urgency × data confidence).
**Alternatives considered:** Pure rules (B) alone is too rigid to show "same weather, different priority for different users" gracefully; pure weighted scoring (C) alone risks a safety alert losing to a high-scoring but low-stakes card.
**Evidence basis:** Standard hybrid-recommender rationale (see literature review); PS explicitly requires both ranking behaviour *and* alert logic that shouldn't be purely score-driven.
**Reversibility:** High.

### D3 — Data strategy
**Decision:** Use **real, live CPCB AQI data** (via data.gov.in or aqicn.org) and **real/global UV index data** (OpenWeatherMap One Call). Use **simulated, IMD-API-shaped** data for core forecast/warnings/rainfall/sunrise-sunset (computed) and mark it clearly as simulated in the demo. Exclude live marine/tide/pollen/soil-moisture from MVP; keep as should-have/simulated-only with disclosure.
**Alternatives considered:** Wait for IMD API whitelisting approval (rejected — timeline risk, outside team's control); scrape mausam.imd.gov.in like unofficial GitHub projects (rejected — fragile, and poor optics for a project explicitly built around an official IMD PS).
**Evidence basis:** `SIH26076_Deep_Research_Dossier.md` §3 data/API landscape table.
**Reversibility:** High — data layer is behind an adapter interface; swapping simulated IMD data for real API access on whitelisting approval is a config/adapter change, not a redesign.

### D4 — Scope of personas for MVP
**Decision:** MVP covers 3 personas with genuinely differentiated behaviour and at least one real-data-backed signal each: (1) Health-conscious / AQI-sensitive, (2) Outdoor fitness/commuter, (3) Parent/family (rain + commute-window alerts). Marine/beachgoer, agriculture, and event-planner personas are should-have/demo-narrative only, not fully built.
**Alternatives considered:** Covering all 8 PS example personas (rejected — spreads a 6-person, 1–2 week team too thin per PS Rule 7, and most of the remaining personas depend on the weakest data sources).
**Evidence basis:** Data feasibility table; PS Rule 7 explicitly permits not forcing every category.
**Reversibility:** Medium — adding a persona later mainly means adding rule/scoring rows and a data adapter, not restructuring the engine.

### D5 — No ML/LLM in the MVP decision path
**Decision:** No ML model and no LLM call sits on the critical path that decides ranking, priority, or alerts. An LLM may optionally *phrase* an already-decided explanation, clearly separated in the architecture.
**Alternatives considered:** LLM-generated recommendations (rejected — see D1 evidence); trained ranking model (rejected — no data).
**Evidence basis:** Cold-start/explainability literature; competitive landscape (LLM-tip apps already exist and are not what judges will find novel or trustworthy for a safety context).
**Reversibility:** High (explicitly designed as a future upgrade path, not a rejected direction).
