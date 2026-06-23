# Prediction Traceability Boundary

* **Status**: Draft
* **Date**: June 23, 2026

---

## 1. Traceability Strategy
Miraichi requires absolute transparency. Every prediction and downstream natural language explanation must trace back to the exact data feed state that triggered it. This prevents system drift, protects against silent errors, and provides audit capability for betting history metrics.

---

## 2. Lineage Propagation Flow
The data pipeline propagates IDs at each boundary:

```
[Raw Feed Data]
      │
      ▼  (Worker Ingestion Job writes normalized cache)
[workerRunId] + [sourceProviderId]
      │
      ▼  (Worker extracts standard snapshot for inference)
[inputCandidateId]
      │
      ▼  (Local AI executes mock prediction engine)
[predictionId] + [engineMode]
      │
      ▼  (LLM generates explanation explaining the prediction)
[Explanation Payload] with trace: [predictionId, inputCandidateId, workerRunId]
```

---

## 3. ID Registry & Mappings

* **`workerRunId`**: Generated at the start of an ingestion cron run. Stamped onto all normalized match and market records.
* **`sourceProviderId`**: Stamped by the adapter parser (e.g. `provider-mock-alpha`) to trace data back to its source feed.
* **`inputCandidateId`**: Generated when data is marshaled into the local AI boundary. Links the inference input to the database state at execution time.
* **`predictionId`**: Stamped onto the prediction output envelope. Used by the API gateway to associate the raw inference outcome with bet slips or chat UI requests.

---

## 4. Verification Checkpoint
To verify lineage during tests:
1. Query a prediction result via `/api/v1/predictions/:id`.
2. Extract the `trace` block from the payload.
3. Assert that `inputCandidateId`, `workerRunId`, and `sourceProviderId` are present and match their corresponding parent records in the worker's cached history logs.
