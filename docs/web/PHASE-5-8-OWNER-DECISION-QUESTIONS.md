# Phase 5.8 Owner Decision Questions

This document presents product-level design and setting decisions that belong exclusively to the owner. AI technical recommendations and trade-offs are included for each.

---

## Question 1: Default Language Choice
What should be the default language of the application for new users?

* **Option A**: **English**
  * *Trade-off*: Standard default for international applications. However, Vietnamese users will have to manually switch.
* **Option B**: **Vietnamese**
  * *Trade-off*: Excellent local-first experience for Vietnamese audiences, but international developers/users will have to switch.
* **Option C**: **Dynamic Detection (Default)** (AI Recommended)
  * *Trade-off*: Automatically detects via browser settings and matches. Falls back to English if no match is found. Avoids manual switching for most users.

---

## Question 2: Browser Language Auto-Detection
Should the app dynamically auto-detect and update the language if the user changes their browser settings, or lock to their manual selection?

* **Option A**: **Strict Override Lock** (AI Recommended)
  * *Trade-off*: The app respects browser language on *first* load. However, if the user manually overrides it in the app settings, that override is permanently locked until changed manually.
* **Option B**: **Dynamic Sync**
  * *Trade-off*: The app always follows browser language. If the user overrides it but later resets browser cache/settings, it switches back, which can confuse users.

---

## Question 3: Settings Placement in the UI
Where should the entrance to the settings panel live?

* **Option A**: **Inside the "Miraichi" Tab** (AI Recommended for current preview)
  * *Trade-off*: Fits easily within the five-tab navigation model. Simplifies UI structure. However, it mixes general settings with assistant features.
* **Option B**: **Top Bar Header Icon (Gear/Profile)**
  * *Trade-off*: Standard pattern on modern mobile apps (top right). Keeps settings accessible from any screen. However, it adds visual noise to the header bar.
* **Option C**: **Dedicated Settings Tab (Replacing a tab)**
  * *Trade-off*: High discoverability, but reduces the navigation space. Breaks the five-tab backbone approved in Phase 5.7.

---

## Question 4: Theme Switching Scope
Should theme switching (e.g. Light mode, custom colors) be planned now or deferred?

* **Option A**: **Defer entirely to later phase** (AI Recommended)
  * *Trade-off*: Focuses development effort on core features first. Keeps pure black baseline. Saves design/testing time.
* **Option B**: **Plan for System Sync and Light Mode toggle**
  * *Trade-off*: Prepares CSS layout structure for light theme early. However, testing two themes increases complexity before core shell features are implemented.

---

## Question 5: Language Settings Availability
Should language settings be available to the user before they log in (unauthenticated states), or only after authorization?

* **Option A**: **Available to all (Pre-Auth & Post-Auth)** (AI Recommended)
  * *Trade-off*: High accessibility. Ensures users can read the login/onboarding screens in their preferred language. Requires storing settings in anonymous local storage.
* **Option B**: **Post-Auth Only**
  * *Trade-off*: Simpler state architecture. Language can be tied directly to a database user profile. However, login screens remain English-only.

---

## Question 6: Design System Baseline Approval
Should the Black Apple Ledger (Option E) preview style remain the locked production baseline for the Phase 5.9 app shell?

* **Option A**: **Yes, approve as current baseline** (AI Recommended)
  * *Trade-off*: Establishes design continuity. Allows engineering to progress immediately to Phase 5.9 shell implementation. Revisions are still easily supported via CSS design tokens.
* **Option B**: **No, request revision**
  * *Trade-off*: Delays production shell implementation until a new design preview is generated and approved.
