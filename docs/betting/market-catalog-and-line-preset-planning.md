# Market Catalog and Line Preset Planning

This document details the design of the market catalog and presets for the betting journal. The goal is to provide standard selectables for typical football matches while keeping the core journal logic decoupled from specific market rules.

---

## 1. Market Categories

Miraichi categorizes betting markets into a flat registry. The candidate list of markets for v1 and future releases includes:

* **1X2 (Full-Time Result)**: Bet on Home Win (1), Draw (X), or Away Win (2).
* **Over / Under (Total Goals)**: Bet on whether the total goals scored will be over or under a specific line value.
* **Handicap (Asian / Spread)**: Bet on a team with a virtual goal advantage or disadvantage applied.
* **Corners**: Total corners over/under, match corners 1X2, or handicap corners.
* **Team Totals**: Over/under goals or corners scored by a specific team.
* **Cards**: Over/under yellow/red cards or total bookings.
* **Custom Market**: Catch-all text entry for arbitrary wagers (e.g. "To qualify", "Correct score").

---

## 2. Line Preset Examples

Presets assist users with rapid data entry on mobile screens. Selecting a market type loads a default list of quick-select buttons:

* **Standard Goal Lines**: `0.5`, `1.0`, `1.5`, `2.0`, `2.5`, `3.0`, `3.5`
* **Quarter Goal Lines (Split)**: `1.25` (representing 1.0 / 1.5), `1.75` (representing 1.5 / 2.0), `2.25`, `2.75`, `3.25`
* **Handicap Lines**: `-1.5`, `-1.0`, `-0.5`, `0` (Draw No Bet), `+0.5`, `+1.0`, `+1.5`

### Manual Override Rule
* Users are never restricted to presets. A text input field must allow typing arbitrary numbers or labels for line configurations (e.g., `4.5` goals, `+2.25` handicap, or `"Over 10"` corners).

---

## 3. Extensible Catalog Architecture

To allow developers to add new markets without modifying the core `BetRecordEnvelope` schemas or database storage:

1. **Registry Pattern**: The `MarketCatalog` acts as a lookup registry containing metadata definitions (market ID, display labels, default presets).
2. **Metadata Envelope**: The `BetRecordEnvelope` stores the selected market simply as a `marketType` string (e.g. `"team_total_corners"`) and a numeric `lineValue` parameter. It does not contain any code related to the market itself.
3. **Decoupled Validations**: Adding a new market only requires adding an entry to a configuration file and optionally writing a validation rule class mapping to that market type.

```
+---------------------+
|  BetRecordEnvelope  | (Pure data schema: marketType="team_total", lineValue=1.5)
+----------+----------+
           |
           v
+---------------------+
|    MarketCatalog    | (Reads mapping config to validate and render presets)
+----------+----------+
           |
           +---> [1X2 Validator]
           +---> [Over/Under Validator]
           +---> [Custom Validator] (New market logic plugged in here)
```
