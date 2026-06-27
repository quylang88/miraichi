# Provider Adapter Contract

* **Status**: Active
* **Date**: 2026-06-23

---

## 1. Purpose
Defines the functional contract and normalization interface required for external sports data feed parsers.

## 2. Scope
Applies to all feed integration modules residing in `apps/worker` or `packages/shared` that parse raw payload structures into generic structures.

## 3. Object Shape
The adapter contract defines the standard parser methods:
* `parseMatches(rawPayload)`: Normalizes raw fixtures arrays.
* `parseMarkets(rawPayload)`: Normalizes raw odds arrays.

It outputs objects in a standardized normalization envelope containing:
* `providerId`: Target vendor ID (e.g. `provider-mock-alpha`).
* `normalizedData`: The resulting Match or Market array.

## 4. Required Fields
* `providerId`: String.
* `parseMatches`: Function signature.
* `parseMarkets`: Function signature.

## 5. Optional Fields
* `metadata`: Key-value properties containing raw header information or transmission lag times.

## 6. Example Mock Payload
```json
{
  "providerId": "provider-mock-alpha",
  "metadata": {
    "feedLatencyMs": 142
  },
  "normalizedData": {
    "matches": [
      {
        "id": "match-alpha-001",
        "competitionId": "competition-alpha",
        "seasonId": "season-alpha-2026",
        "homeTeamId": "team-alpha",
        "awayTeamId": "team-beta",
        "status": "scheduled",
        "kickoffTime": "2026-06-23T22:23:56Z"
      }
    ]
  }
}
```

## 7. Validation Notes
* All adapters must throw standard parser errors on invalid JSON schemas.
* Custom provider adapters must not mutate the internal generic model signatures.

## 8. What It Must Not Decide Yet
* Specific HTTP routing urls, retry policies, webhook token headers, or vendor payment thresholds.
* The specific vendor SDK package integrations.
