# Presentation and Demo Guide

> **For:** The SIH 2026 PPT and Presentation Team
> **Purpose:** Scripting the narrative, structuring the pitch deck, and clarifying the boundaries of what is built vs. what is planned.

## 1. Core Narrative

**The Problem (SIH26076):** Right now, weather apps act like megaphones. They shout the exact same information to everyone. But weather doesn't impact everyone equally. An asthma patient needs to know about air quality; a cyclist needs to know about daylight and wind; a parent needs to know if it will rain during the school commute.

**Our Core Idea:** We didn't build a new weather app. We built an **intelligent personalization layer** for the Mausam app. It takes the same weather data, evaluates who the user is, and mathematically re-orders the homepage to prioritize what matters specifically to them.

**Our Innovation (Why Judges Care):** We are NOT using an LLM to hallucinate text. We built a deterministic, mathematical Scoring Engine. This means our recommendations are 100% auditable. When a user asks "Why am I seeing this card at the top?", we can show them the exact environmental signal and calculation that put it there. For a government safety application, auditability isn't a feature; it's a requirement.

## 2. Recommended PPT Storyline (Maximum 15 Slides)

| Slide | Title | Key Message / Presenter Action |
|---|---|---|
| 1 | Title Slide | Project name + SIH26076. |
| 2 | The Problem | Generic dashboards fail edge-case users. The information they need is buried. |
| 3 | The Vision | Shift from a "General Weather App" to a "Context-Aware Dashboard". |
| 4 | User Personas | Introduce the 3 MVP personas: Health-Conscious, Fitness, Parents. |
| 5 | How it Works (Concept) | Show a visual equation: `Weather Signals + User Persona + Time Context = Personalized Homepage`. |
| 6 | System Architecture | Show a simplified Mermaid block diagram. Highlight that the Engine is separated from the UI. |
| 7 | **LIVE DEMO STARTS** | Switch to the screen sharing/device. |
| 8 | Demo: Cold Start | Show that without a login, the app defaults to safety-first (Severe warnings > General Weather). |
| 9 | Demo: Persona Switch | Change the persona to Health. Watch the screen actively re-order. *Say: "Same weather, different person."* |
| 10 | Demo: Explainability | Tap the top card to show the Explanation sheet. *Say: "This isn't AI guessing. This is math. Here is the exact data source."* |
| 11 | Demo: Degraded Data | (Optional) Show a card badged as "Simulated" or "Unavailable". Emphasize honesty in API failures. |
| 12 | The Technology Stack | Next.js, FastAPI, PostgreSQL, modular Data Adapters. |
| 13 | Future Scope | List the deferred personas (Agriculture, Beachgoers, Travelers) and live API IMD whitelisting. |
| 14 | Business Impact | Increased user engagement for Mausam app, better public safety communication, accessibility. |
| 15 | Q&A | Thank you screen. |

## 3. Important Rules for Presenting

To maintain credibility during Q&A, the team must strictly adhere to the following when speaking:

### ✅ IDEAS WE ABSOLUTELY CLAIM:
- **Auditability:** We can mathematically explain every UI choice.
- **Modularity:** Our system is designed so that adding "Agriculture" later is just adding a new row to a data table, not rewriting the app.
- **Graceful Degradation:** If an API goes down, we don't crash. We show cached data with an honest timestamp badge.

### ❌ CLAIMS WE MUST NEVER MAKE (YET):
- **"We built all 8 personas."** (False. We deeply built 3 to prove the concept. Say: *"We focused on 3 personas for the MVP to prove the engineering model, the rest are scheduled for next quarter."*)
- **"We are using live IMD APIs."** (False. We are using structurally identical simulated fixtures because we lack IP whitelisting. Say: *"We built our adapters to the exact JSON shape of the IMD API, but are running fixtures today pending official whitelisting."*)
- **"The AI decided this."** (False. Do not use the word AI for the ranking logic. It is a mathematical scoring engine. Using the word AI opens you up to questions about ML training data, which you don't have.)
