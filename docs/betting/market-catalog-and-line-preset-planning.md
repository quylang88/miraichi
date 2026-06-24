# Market Catalog and Line Preset Planning

This document details the owner-applied candidate design of the market catalog and presets for the betting journal. The goal is to provide standard selectables for generic football matches while keeping core journal logic decoupled from specific market rules.

---

## 1. V1 Built-In Market Baseline

Miraichi categorizes betting markets into a flat registry. The owner-approved v1 baseline is:

* **1X2 (Full-Time Result)**: Bet on Home Win (1), Draw (X), or Away Win (2).
* **Over / Under (Total Goals)**: Bet on whether the total goals scored will be over or under a specific line value.
* **Handicap (Asian / Spread)**: Bet on a team with a virtual goal advantage or disadvantage applied.
* **Corners**: Total corners over/under, match corners 1X2, or handicap corners.
* **Custom Market**: Catch-all text entry for arbitrary wagers.

### Deferred Market Families

The following market families are deferred:

* **Team Totals**: Over/under goals or corners scored by a specific team.
* **Cards**: Over/under yellow/red cards or total bookings.
* **First Half**: First-half-only markets.
* **BTTS**: Both teams to score markets.
* **Player Props**: Player-specific markets.
* **Exact Score**: Exact score markets.
* **Other Detailed Market Families**: Any specialized market family not included in the v1 baseline.

---

## 2. Line Preset Examples

Presets assist users with rapid data entry on mobile screens. Preset lists should be configurable. The following examples are candidate planning examples only and do not implement validation or settlement behavior:

* **Standard Goal Lines**: `0.5`, `1.0`, `1.5`, `2.0`, `2.5`, `3.0`, `3.5`
* **Quarter Goal Lines (Split)**: `1.25` (representing 1.0 / 1.5), `1.75` (representing 1.5 / 2.0), `2.25`, `2.75`, `3.25`
* **Handicap Lines**: `-1.5`, `-1.0`, `-0.5`, `0` (Draw No Bet), `+0.5`, `+1.0`, `+1.5`

### Manual Override Rule
* Users are never restricted to presets. A text input field must allow typing arbitrary numbers or labels for line configurations.
* If a line is not a standard 0.25 increment, the UI should show a warning but must not block save.

---

## 3. Extensible Catalog Architecture

To allow developers to add new markets without modifying the core `BetRecordEnvelope` contract or future persistence layer:

1. **Registry Pattern**: The `MarketCatalog` acts as a lookup registry containing metadata definitions (market ID, display labels, default presets).
2. **Metadata Envelope**: The `BetRecordEnvelope` stores the selected market as `marketType`, optional `marketSubtype`, optional `lineValue`, and optional `lineDisplay`. It does not contain market logic.
3. **Decoupled Validations**: Adding a new market later should require configuration or a registered validator boundary, not changes to the core bet record.

```
+---------------------+
|  BetRecordEnvelope  | (Pure candidate contract: marketType="custom_market")
+----------+----------+
           |
           v
+---------------------+
|    MarketCatalog    | (Reads mapping config to render choices and warnings)
+----------+----------+
           |
           +---> [1X2 Validator]
           +---> [Over/Under Validator]
           +---> [Custom Validator] (New market logic plugged in here)
```
