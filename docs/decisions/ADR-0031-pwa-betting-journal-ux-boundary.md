# ADR-0031: PWA Betting Journal UX Boundary

* **Status**: Draft
* **Date**: 2026-06-24
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started

---

## 1. Context
Users require a highly responsive interface on mobile devices to log wagers quickly. Complex desktop-focused layouts lead to data-entry friction and low user engagement.

## 2. Owner-Approved Business Decisions
* **Mobile-First PWA UX**: The interface must prioritize mobile screen sizes and follow Progressive Web App design guidelines.
* **V1 Primary Navigation**: The navigation system will expose exactly five tabs:
  - `Today`: Logged wagers for the current date.
  - `Add`: The quick-entry bet logging form.
  - `Matches`: The grouped matches list.
  - `Reports`: The daily, weekly, and monthly aggregate indicators.
  - `AI`: Future AI betting suggestions.
* **Dashboard Layout Rules**:
  - The main wagers view will use a list-based layout grouped chronologically by date.
  - Match wagers must be nested within expandable accordion headers.
  - Provide horizontal scrolling filter pills: `Pending`, `Settled`, `Live`, and `Market`.
  - The "Add Bet" action must be the primary visible trigger in the interface (e.g. Floating Action Button or center tab icon).
* **Calendar-First UI Deferral**: A full grid calendar view is out-of-scope for v1.
* **No Native Wrapper**: Native iOS/Android wrappers are deferred.
* **Theme**: The default presentation theme will be a premium dark mode.

## 3. AI Technical Recommendations
* **Thumb-Zone Navigation**: Place the primary tab bar at the bottom of the viewport, ensuring all tabs are within the comfortable reach of a user's thumb.
* **Single-Tap Entry**: Ensure the "Add" tab is reachable from any page in the app with exactly one tap.
* **Progressive Disclosure**: Hide optional metadata fields (e.g. season, trace keys, custom notes) under an "Advanced Options" toggle button in the entry form to keep the interface simple.
* **Placeholder/Refusal Safe Tab**: The `AI` tab must render a clean placeholder card stating that predictions are unavailable until the prediction ADR is approved, avoiding error crashes.

## 4. Deferred Business Decisions
* The final visual styles, font families, and brand color configurations.
* The design of advanced graphical charts and graphs for long-term reporting.
* The timeline and wrapper choice for native application packages.
* The UI details of how prediction cards are presented when recommendations are enabled.

## 5. Future Extension Points
* Calendar view grids.
* Rich SVG/canvas reporting charts.
* Backup/export settings views.
* Custom browser install prompts.
* Native wrappers (Capacitor/Cordova).

## 6. Explicit Implementation Exclusions
* No final HTML, CSS, or framework view code.
* No native Android or iOS wrapper setup files.
* No real AI prediction card recommendation streams.
* No mathematical client-side calculations.
* No executable code implementation.
