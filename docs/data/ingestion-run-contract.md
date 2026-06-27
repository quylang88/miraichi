# Ingestion Run Contract

* **Status**: Active
* **Date**: 2026-06-23

---

## 1. Purpose
Defines the schema for tracking, logging, and auditing ingestion execution cycles.

## 2. Scope
Applies to metadata records generated at the completion of each worker cycle in `apps/worker`.

## 3. Object Shape
Includes start/end execution timestamps, provider origin, status indicators, and counters for imported/skipped records.

## 4. Required Fields
* `id`: Unique run tracking identifier (e.g. `run-alpha-001`).
* `providerId`: Source feed adapter ID (e.g. `provider-mock-alpha`).
* `status`: Job result state (e.g. `success`, `partial_failure`, `failed`).
* `startTime`: ISO-8601 UTC timestamp.
* `endTime`: ISO-8601 UTC timestamp.
* `metrics`: Ingest stats collection.
  * `processedCount`: Total records parsed.
  * `successCount`: Total records successfully normalized.
  * `skippedCount`: Total records filtered out due to validation failures.

## 5. Optional Fields
* `errorMessage`: Exception log string (required if status is `failed`).

## 6. Example Mock Payload
```json
{
  "id": "run-alpha-001",
  "providerId": "provider-mock-alpha",
  "status": "success",
  "startTime": "2026-06-23T22:20:00Z",
  "endTime": "2026-06-23T22:20:02Z",
  "metrics": {
    "processedCount": 10,
    "successCount": 9,
    "skippedCount": 1
  }
}
```

## 7. Validation Notes
* `processedCount` must equal `successCount + skippedCount`.
* `endTime` must be equal to or greater than `startTime`.
* If status is `failed`, `errorMessage` must be provided.

## 8. What It Must Not Decide Yet
* Production audit databases, file logger layouts, exception reporting integrations (e.g., Sentry), or Slack channel webhook notifications.
