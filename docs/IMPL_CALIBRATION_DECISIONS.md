# Implementation-Level Calibration Decisions

This file records implementation-level calibration and resolution decisions made
during development. It supplements the frozen authoritative planning documents
— it **does not modify** them. Entries here resolve documented gaps or contradictions
at the implementation level only.

---

## CAL-01 — `rain_commute` urgency multiplier: `commute + ≥60% precip` band

**Date:** 2026-08-26
**Finding:** Milestone 1 Independent Audit, F-01
**Status:** Resolved (implemented in `engine/scoring.py`)

### The Problem

`03_...md §88` states: Family persona + commute window active + rain expected → rain_commute card → **P1**.

The scoring formula (`03_...md §4`) is: `score = persona_weight × urgency_multiplier × confidence_factor`

The frozen values are:
```
persona_weight  (rain_commute, family)  = 0.95    [15_...md §1]
confidence      (simulated IMD rain)    = 0.7     [03_...md §4]
urgency         (commute + ≥60% precip) = 2.0     [15_...md §1, original]
P1 threshold                            = 1.5     [03_...md §5]
```

Maximum possible score under original values: `0.95 × 2.0 × 0.7 = 1.33 < 1.5`

This means simulated rain for the Family persona could **never** reach P1 under the
original constants, directly contradicting `03_...md §88`.

### Why This Is an Implementation-Level Gap (Not a Spec Contradiction)

`15_...md §1` introduces its PERSONA_WEIGHT and urgency values explicitly as:

> *"Full 8-card × 4-persona table. Every value here is a **design placeholder** per
> Flag 7 in 00_consistency_check_and_flags.md — sanity-check against eval/run_spike.py
> output before treating any of these as final/tuned."*

The rain urgency value was a placeholder. The `03_...md §88` Scenario A intent is
authoritative; the placeholder urgency value was not.

### Resolution

Change the `commute + ≥60%` rain urgency band from `2.0` to `2.35`.

```
New math: 0.95 × 2.35 × 0.7 = 1.56275 ≥ 1.5 → P1  ✅
```

**What was NOT changed:**
- `P1_THRESHOLD` (remains 1.5)
- `PERSONA_WEIGHT` for any card/persona pair
- `confidence_factor` for any source type
- Any other urgency band in `scoring.py`

This is the minimum change that makes `03_...md §88` mathematically achievable
with simulated data.

### Test Regression Coverage (see `engine/tests/test_remediation.py`)

- `test_f01_scenario_a_family_simulated60_commute_reaches_p1` — proof of fix
- `test_f01_scenario_a_family_simulated60_score_math_explicit` — explicit math check
- `test_f01_scenario_a_family_simulated40_commute_stays_p2` — boundary: 40%→P2, not P1
- `test_f01_no_commute_rain_never_p1_with_simulated_data` — non-commute window

---

## CAL-02 — Alert priority floor: P3 alert cards elevated to P2

**Date:** 2026-08-26
**Finding:** Milestone 1 Independent Audit, F-02
**Status:** Resolved (implemented in `engine/priority.py`)

### The Problem

`03_...md §6` states: *"Alerts are never suppressed by low confidence_factor — instead,
a low-confidence alert is shown **with** a 'based on limited/simulated data' disclosure,
never **hidden**."*

`03_...md §5` defines P3 as: *"shown lower on the page or **collapsed**."*

If a card is `is_alert=True` and its raw score (reduced by low confidence) places it
in P3, the P3 "collapsed" treatment directly violates §6's "never hidden" requirement.

### Resolution

Added `apply_alert_priority_floor(priority, is_alert)` to `engine/priority.py`.
Called from `engine.py` after both `classify_priority()` and `is_alert()` are computed.

```python
if alert and priority == "P3":
    return "P2"
return priority  # all other cases unchanged
```

**What is NOT changed:**
- `RankedCard.score` — always the raw formula value; never floored
- `score_components` — all three factors remain unchanged for traceability
- Non-alert P3 cards remain P3
- No alerts are promoted from P2 to P1 (only P3 → P2 floor)

### Test Regression Coverage

- `test_f02_stale_alert_has_p2_floor_not_p3`
- `test_f02_stale_alert_score_is_raw_not_floored`
- `test_f02_non_alert_p3_stays_p3`
- `test_f02_simulated_alert_has_at_least_p2`
