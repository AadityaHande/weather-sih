# Frontend Product Specification

## 1. Product Vision and Problem Statement
**SIH26076: Development of personalized homepage for 'Mausam' mobile application**

Generic weather applications provide the exact same dashboard to every user. However, a parent checking the weather for a school run, an athlete planning a workout, and an asthma patient care about fundamentally different environmental signals. 

**Our Solution:** We are building an intelligent personalization layer for the Mausam app. It is **not** a replacement weather app. It is a contextual relevance engine that dynamically reorders, prioritizes, and explains weather cards based on the user's declared persona, health flags, and the current environmental context (time, weather, warnings).

## 2. Current MVP Scope
The MVP demonstrates the core value proposition: **the same weather conditions lead to different, explainable homepages for different users.**

The MVP intentionally focuses deeply on 3 of the 8 official personas. The engine logic and API are implemented and running on the backend. The adapter architecture is implemented, with current adapters configured for fixture-backed and safe-fallback operation during the MVP. The frontend is exclusively responsible for rendering the API's sorted outputs and managing user preferences.

## 3. Personas

### 3.1 Supported Personas (IMPLEMENTED)
1. **Health-conscious users:** Focus on AQI, UV Index, and humidity. Receives elevated urgency if asthma/respiratory flags are set.
2. **Outdoor fitness enthusiasts:** Focus on daylight hours (sunrise/sunset), activity windows, UV, and heat alerts.
3. **Parents & families:** Focus on rain probability, especially during commute windows, and severe warnings.

### 3.2 Deferred Personas (FUTURE / DEFERRED)
The following official SIH personas are explicitly deferred to future milestones (per Decision D4):
- **Beachgoers & surfers:** Requires INCOIS marine APIs (unavailable/no public access).
- **Travelers:** Requires multi-destination routing and flight data integrations.
- **Agriculture & gardeners:** Requires specialized agromet data.
- **Commuters (traffic integration):** Requires external, non-MoES traffic APIs mapping.
- **Event planners:** Requires multi-day confidence indexes and comfort score formulas.

## 4. Product Principles
- **No re-ranking on the client:** The backend owns the ranking logic. The frontend must blindly obey the sorted order.
- **Always explainable:** Every personalized card must be traceable back to a real environmental signal. Explanations are deterministic, not AI hallucinations.
- **Safety first:** Severe warnings always bypass persona preferences to become P0 alerts.
- **Honest data:** Simulated, cached, or unavailable data must be explicitly badged in the UI. 

## 5. End-to-End User Journeys

### 5.1 First-time User Flow
1. User opens the app.
2. A generic `device_id` is generated locally. No login/signup required.
3. App fetches `/homepage`.
4. Backend evaluates the environment with a "default-general" persona.
5. User sees a sensible baseline weather page.
6. A dismissible prompt suggests personalizing the experience.

### 5.2 Preferences Update Flow
1. User taps "Personalize" or settings.
2. User selects one or more personas (e.g., "Health" + "Fitness") and toggles health flags.
3. App sends `PUT /preferences`.
4. App immediately fetches `GET /homepage`.
5. The cards animate into their new ranked positions. **This is the core demo moment.**

### 5.3 Explanation Interaction
1. User sees a card (e.g., AQI is top-ranked).
2. User taps the card or its info icon.
3. App fetches `GET /explain` using the card's `explanation_ref`.
4. A bottom sheet appears explaining exactly *why* it was ranked highly (e.g., "Because AQI is 165 and you are a health-conscious user").

## 6. Behavior Specifications

### 6.1 Severe Warning Behavior (P0)
If the backend returns items in the `warnings_override` array, these are P0 (highest possible priority). 
- **Requirement:** Must be rendered at the very top of the screen in a distinct red banner, outside of standard card scrolling.

### 6.2 Degraded and Unavailable Data
- If an individual card's `source` is "unavailable", the card may be omitted by the backend, or returned with a degraded badge. The frontend must show exactly the badge requested by the backend (e.g., "Simulated for demo", "Data unavailable").
- If the entire backend context fails, the `system_notice` field string is provided. The frontend must display this as a persistent banner.

## 7. Rules the Frontend MUST NOT Violate
1. **DO NOT** sort, filter, or re-rank the `cards[]` array.
2. **DO NOT** construct explanation strings locally.
3. **DO NOT** attempt to guess which data is simulated. Use the `source` field.
4. **DO NOT** introduce a login screen or authentication barrier.

## 8. MVP Acceptance Criteria
- [ ] Users can open the web app and immediately see a default homepage.
- [ ] Users can change their persona to "Health", "Fitness", or "Family".
- [ ] Changing the persona instantly re-renders the card order.
- [ ] Severe warnings appear fixed at the top regardless of persona.
- [ ] Every card can be tapped to reveal a backend-driven explanation sheet.
- [ ] Badges correctly identify simulated vs. live data.
