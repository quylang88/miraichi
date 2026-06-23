# Mock Ingestion Flow

* **Status**: Draft
* **Date**: 2026-06-23

---

## 1. Purpose
Documents the workflow stages of mock ingestion processing executed in memory during local development.

## 2. Scope
Applies to the background scheduling scheduler inside `apps/worker` reading from static mock JSON fixture files.

## 3. Flow Stages
1. **Trigger**: Background worker ticks on a simulated cron cycle.
2. **Read File**: Worker reads raw static mock payload from local files (e.g. `generic-matches.mock.json`).
3. **Parse Adapter**: The payload is passed to `MockProviderAdapter.parseMatches()`.
4. **Clean & Validate**: Basic filters discard matches with negative scores or invalid competition windows.
5. **Memory Stub Commit**: Normalized outputs are written to the shared memory array.
6. **Execution Audit**: An Ingestion Run contract summary is logged to console output.

## 4. Required Inputs
* Local file path containing mock JSON arrays.
* Active memory stub instance within the package runtime.

## 5. Optional Steps
* Processing optional odds listings through `MockProviderAdapter.parseMarkets()`.

## 6. Example Mock Flow Trace
```json
{
  "traceId": "trace-alpha-12345",
  "steps": [
    { "stepName": "trigger_tick", "timestamp": "2026-06-23T22:20:00Z" },
    { "stepName": "read_mock_file", "path": "generic-matches.mock.json" },
    { "stepName": "adapter_normalization", "adapter": "MockProviderAdapter" },
    { "stepName": "validation_check", "results": "passed: 5, failed: 0" },
    { "stepName": "transient_save", "target": "memory_repository" },
    { "stepName": "job_complete", "runId": "run-alpha-001" }
  ]
}
```

## 7. Validation Notes
* If the static mock file is corrupted, the flow must fail gracefully, log the run status as `failed`, and terminate.
* Normalization must not alter source values except to transform keys.

## 8. What It Must Not Decide Yet
* Production job queue managers (e.g. BullMQ, Celery).
* Production container layouts or cluster pod scheduling.
