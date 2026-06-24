# ADR-0025: Market Catalog and Line Preset Registry

* **Status**: Draft
* **Date**: 2026-06-24
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started

---

## 1. Context
Wagers span various market types (e.g. Handicap, 1X2). Hardcoding how these markets are validated or displayed leads to rigid systems that cannot support future sports or wager categories. We need an extensible registry.

## 2. Owner-Approved Business Decisions
* **V1 Built-in Markets**:
  - `1X2` (Home Win, Draw, Away Win)
  - `over_under` (Total Goals)
  - `handicap` (Spread)
  - `corners` (Total Corners)
  - `custom` (Free text catch-all market)
* **Deferred Markets**: The following markets are out-of-scope for the MVP and deferred to future releases:
  - Cards (Bookings)
  - Team Totals
  - First Half wagers
  - BTTS (Both Teams to Score)
  - Player props
  - Exact score
  - Other detailed market families
* **Catalog Interfaces**: The concepts of `MarketCatalog` (lookup registry) and `MarketTypeRegistry` (validator matcher) are accepted as the standard domain boundaries.
* **Configurable Presets**: Line presets must be configurable and adjustable by config files.
* **Manual Overrides**: Manual entry of any arbitrary line value must always be allowed in forms.
* **Warning Validation**: If a user enters a line that is not a standard `0.25` increment (e.g. `2.34` goals), the application must display a warning notification in the UI, but it must **not** block the user from saving the wager.

## 3. AI Technical Recommendations
* **Configuration-Driven**: Design the `MarketCatalog` to load active markets from a static JSON configuration file in the ui/packages layer.
* **Registry Isolation**: Do not place settlement or calculation logic inside the registry or catalog files during Wave A. Keep validators restricted strictly to presentational verification helper checks.
* **Custom Escape Hatch**: The `"custom"` market should behave as a text field pass-through, bypassing line validations entirely.
* **Decoupled Presets**: Keep the list of presets in a dedicated `LinePresetRegistry` lookup utility, keeping the raw `BetRecordEnvelope` data container stateless.

## 4. Deferred Business Decisions
* The exact user-facing localization text strings for market labels.
* The final list of standard preset options for Handicap and Corners.
* The detailed settlement math for half-win/half-loss quarter line handicap wagers.
* Future transitions from warning-only validations to strict input restrictions.

## 5. Future Extension Points
* Adding modules for Cards, Team Totals, BTTS, and First Half wagers.
* User-defined custom templates where users can pre-save their own frequent custom markets.

## 6. Explicit Implementation Exclusions
* No mathematical equations or logic for settlement calculations.
* No hard-block validator scripts that prevent bet record creation.
* No market-specific calculations or parsing inside the generic UI/API mediation boundaries.
* No executable code implementation.
