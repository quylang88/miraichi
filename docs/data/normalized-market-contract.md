# Normalized Market Contract

* **Status**: Active
* **Date**: 2026-06-23

---

## 1. Purpose
Defines the logical schema contract representing betting markets and odds for a fixture.

## 2. Scope
Applies to odds feeds normalized from provider adapter payloads and distributed via APIs.

## 3. Object Shape
Includes references to the match ID, market type classification, and a list of selection outcomes with decimal odds.

## 4. Required Fields
* `id`: Unique market identifier (e.g. `market-alpha-001`).
* `matchId`: Target match identifier (e.g. `match-alpha-001`).
* `marketName`: Classification tag (e.g. `1X2`, `over_under_2.5`).
* `outcomes`: Array of outcome options.
  * `outcomeId`: Option identifier (e.g. `outcome-home`).
  * `name`: Choice descriptor (e.g. `home`, `draw`, `away`).
  * `odds`: Decimal odds representation (strictly positive float).

## 5. Optional Fields
* `providerId`: Vendor tracking tag (e.g. `provider-mock-alpha`).
* `updatedAt`: ISO-8601 UTC timestamp of last odds change.

## 6. Example Mock Payload
```json
{
  "id": "market-alpha-001",
  "matchId": "match-alpha-001",
  "marketName": "1X2",
  "providerId": "provider-mock-alpha",
  "updatedAt": "2026-06-23T22:23:56Z",
  "outcomes": [
    {
      "outcomeId": "outcome-home",
      "name": "home",
      "odds": 1.85
    },
    {
      "outcomeId": "outcome-draw",
      "name": "draw",
      "odds": 3.40
    },
    {
      "outcomeId": "outcome-away",
      "name": "away",
      "odds": 4.20
    }
  ]
}
```

## 7. Validation Notes
* Odds values must be decimal numbers strictly greater than `1.0`.
* The `outcomes` array must contain at least two entries (no single-outcome markets allowed).
* All outcome names must map to standard generic terms.

## 8. What It Must Not Decide Yet
* Production DB table mapping, column size limits, foreign key indices, or relational cascade rules.
* Decimal precision settings in SQL (e.g., `DECIMAL(10,2)`).
