# UI Screen Specification

This specification dictates the screens required for the frontend MVP.

## 1. Screen Inventory

| ID | Name | Priority | Status |
|----|------|----------|--------|
| S1 | Cold-start Homepage | MUST BUILD | Scaffolded |
| S2 | Personalized Homepage | MUST BUILD | Scaffolded |
| S3 | Explanation Sheet | MUST BUILD | Pending |
| S4 | Preferences Editor | MUST BUILD | Pending |
| S5 | Degraded / Loading Shell | MUST BUILD | Pending |

---

## 2. Screen Details

### S1 & S2: Homepage
*S1 (Cold-Start) and S2 (Personalized) are technically the same screen, just fed different data by the backend.*

**Purpose:** Display the dynamically ranked weather cards based on backend logic.
**Entry Point:** App launch.
**Required UI Components:**
- Top Navigation Bar (with settings icon leading to S4).
- P0 Warning Banner Strip (Conditional).
- Vertical Scrollable List of Weather Cards.
- Each Card contains: 
    - Icon based on `card_id`
    - `title`
    - `value_summary`
    - `freshness_badge` (Required if source != live)
    - "Tap for info" affordance
- Bottom banner for `system_notice` (Conditional).

**API Mapping:** `GET /homepage`
**Loading State:** Skeleton cards matching the approximate size of weather cards.
**Important Rule:** Strict visual ordering based on the array index returned by the API.

---

### S3: Explanation Sheet
**Purpose:** Provide the user with auditable transparency as to why a card was ranked where it was.
**Entry Point:** Tapping a card on S1/S2.
**Required UI Components:**
- Bottom sheet or modal overlay (should not navigate away from the homepage).
- Title (e.g., "Why am I seeing this?").
- primary `text` block (human-readable explanation).
- "Based on the following data:" List (mapping over `signal_refs`).
    - Ex: "AQI: 165 (simulated)"
- Collapse/Close button.

**API Mapping:** `GET /explain?explanation_ref={ref}`
**Loading State:** Simple rotating loader or text skeleton inside the sheet.

---

### S4: Preferences Editor
**Purpose:** Allow the user to select their personas and health flags.
**Entry Point:** Tapping the settings/person icon in the Navigation Bar.
**Required UI Components:**
- Full-screen or large modal view.
- "Select your priorities" section (Multi-select toggles or checkboxes for: Health, Fitness, Family).
- "Health details" section (Checkbox for: Respiratory Sensitive).
- Back/Close button.

**API Mapping:** 
- `GET /preferences` (on load)
- `PUT /preferences` (on change)
**Interaction:** 
**CRITICAL:** When the user closes this screen, the app MUST silently trigger a new `GET /homepage` request and the homepage cards must animate into their newly ranked positions.

---

### S5: Loading / Degraded States
**Purpose:** Handle real-world API failures gracefully without lying to the user.
**Required UI Components:**
- Card-level badging: A small UI pill inside the card (e.g., "Simulated for demo"). Maps to `CardResponse.source`.
- System Notice Banner: A distinct banner (not red like a P0 warning, perhaps yellow/grey) rendering the `system_notice` string if the backend returns it.

**Important Rule:** The frontend should never show an empty white screen. Even in offline modes, standard Next.js / React Query caching should attempt to show stale UI while presenting a connection error banner.
