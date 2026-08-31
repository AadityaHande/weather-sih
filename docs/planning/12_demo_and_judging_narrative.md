# 12 — Demo and Judging Narrative

Consistent with the novelty framing already locked in `02_novelty_and_competitive_landscape.md` and the acceptance criteria in `13_final_mvp_specification.md`. This file is the presentation script's backbone, not new product decisions.

## 1. Exact Demo Story (order matters)

1. **Open cold.** Show a fresh device with no preferences set. Homepage is already sensible, non-empty, safety-first. Say: "No login, no setup — day one, this already works." *(Demonstrates PS point 6 directly, and pre-empts the "what about new users" question before it's asked.)*
2. **Set two different personas live**, one at a time, on the *same* underlying weather state. Show the card order visibly reorder each time. Say: "Same weather, right now, two different people — watch what moves." *(This is the single most important beat — it is the literal proof that this is not a static persona template, which is the PS's own explicitly-rejected pattern.)*
3. **Tap a card, open the explanation.** Point at the actual number in the explanation and the actual number on the card — show they match. Say: "This isn't a generated sentence — it's the same number driving both the rank and the reason."
4. **Change the context, not the persona** — advance time or inject a warning. Show the same user's homepage reorder again, for a different reason. Say: "Same user. The weather changed, not their identity — so the ranking changed too."
5. **Kill a data feed live** (disconnect network for one adapter, or use a demo toggle). Show the degraded badge appear, the card sink or flag itself, nothing crash. Say: "And when data isn't available, we don't hide that or fake a number — we say so."
6. **Close with the "why now, why us" line** (see §3 below), not a features recap.

## 2. How to Demonstrate Personalization Rather Than Merely Changing Personas
The failure mode to avoid: a demo that only shows step 2 above looks identical to a static persona template from the audience's point of view. Steps 3–5 are what separate this from that pattern, and **must not be cut for time** — if the demo is short on time, cut UI polish or a should-have persona, never steps 3–5.

## 3. How to Show Explainability, Cold Start, and Degraded-Data Handling
Already scripted as steps 1, 3, and 5 above. Do not describe these in slides only — they must be shown live, because "we handle this" is a claim judges have heard from every team; "watch this happen" is not.

## 4. Likely Judge Questions and Honest Answers

**Q: "Isn't this just what Google Weather / AccuWeather already does?"**
A: Partially, yes — and we say that up front rather than waiting to be caught. What those apps do is generate a plausible-sounding sentence from an LLM; ours ranks and explains from an auditable rule/scoring engine, which is what a government safety app needs — you can trace every decision back to a real number, not a model's guess. (Points directly to `02_...md` and the explanation contract in `07_...md`.)

**Q: "Is this using real IMD data?"**
A: AQI and UV are real and live, from CPCB and a global provider. IMD's own forecast/warning API requires IP whitelisting that a student team can't get approved in this timeframe — so we built against realistically-shaped simulated data behind the exact same interface a real IMD feed would use, and we've filed the actual whitelisting request in parallel. That's an honest, disclosed limitation, not something we're hiding. (Points to `08_...md` and Flag 5 in `00_consistency_check_and_flags.md`.)

**Q: "Why not just use ML/AI for the ranking?"**
A: We don't have real usage data yet — a learned model with no training data would be worse, not better, than a well-designed rule/scoring system, and it would be a black box in a context where explainability matters. The architecture is built so a learned ranker can slot in later once real usage exists, without a rewrite. (Points to D1/D5 in `00_project_decision_log.md`.)

**Q: "How do you know your engine is actually better than a simpler persona-switch approach?"**
A: We ran a small hand-labelled evaluation before committing to the full build — [state the actual spike result here once run, honestly, including if it was only a CONDITIONAL GO]. We're not claiming a large statistically powered study; we're claiming we tested it before believing it. (Points to `04_...md` and `05_...md`.)

**Q: "What about beachgoers / farmers / travelers?"**
A: We deliberately scoped to 3 personas we could build and validate properly in the time available, rather than doing 8 shallowly. The same engine extends to those personas — it's a data/rule-table addition, not an architecture change — and that's our stated next-round roadmap. (Points to D4 in decision log and `13_...md` out-of-scope section.)

## 5. Claims We Should NOT Make Unless Validated
- "No one has built personalized weather before" — false, and disprovable by any judge with the Pixel Weather app (Flag 4).
- "Our AI works" as an unqualified claim — there is no ML in the MVP; say "our engine" or "our ranking logic," not "our AI," to avoid an inaccurate and easily-challenged framing.
- Any specific accuracy/performance percentage not actually produced by the spike (`04_...md`) — do not estimate or round up a number that wasn't measured.
- "Real IMD data" for anything that is in fact the simulated fixture layer — the source badges in the UI (`06_...md` §4) exist precisely so the team never has to make this claim inaccurately, live or on slides.
- Presenting the pollen or marine cards (if shown at all) as validated/authoritative — they are illustrative only, per `13_...md` known limitations.
