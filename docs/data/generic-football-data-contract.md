# Generic Football Data Contract

* **Status**: Active
* **Date**: 2026-06-23

---

## 1. Purpose
Defines the high-level architecture and mapping rules for generic sports data models within Miraichi. It ensures that all feeds are normalized into a single, provider-agnostic domain contract.

## 2. Scope
Applies to all match metadata, odds listings, market entries, and ingestion metadata records processed by `apps/worker` and consumed by downstream API gateways or prediction mock pipelines.

## 3. Object Shape
All data structures conform to a clean nested format where fixtures, markets, and metadata are clearly separated. 

## 4. Required Fields
* `id`: Unique string identifier for the entity.
* `modelType`: String value indicating the contract type (e.g., `match`, `market`, `run`).

## 5. Optional Fields
* `metadata`: Key-value object hosting audit-trail stamps or provider-specific references.

## 6. Example Mock Payload
```json
{
  "id": "match-alpha-001",
  "modelType": "match",
  "metadata": {
    "providerId": "provider-mock-alpha",
    "ingestedAt": "2026-06-23T22:23:56Z"
  }
}
```

## 7. Validation Notes
* All IDs must follow the competition-agnostic pattern (e.g. `match-alpha-001`).
* `modelType` values must belong to the approved registry (`match`, `market`, `run`).

## 8. What It Must Not Decide Yet
* The TypeScript file imports or type configuration layout (deferred under ADR-0015).
* Database table structures, column constraints, or foreign keys.
