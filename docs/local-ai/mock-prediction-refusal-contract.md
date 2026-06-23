# Mock Prediction Refusal Contract

* **Status**: Draft
* **Date**: June 23, 2026

---

## 1. Context & Purpose
When a prediction request is received, the mock engine must default to a safe refusal fallback mode. This ensures that no speculative or unauthorized forecasts are returned, satisfying owner governance rules while verifying data trace lineage propagation.

---

## 2. Refusal Payload Specification
If predictionAvailable is false, the engine returns the following envelope structure:

```json
{
  "predictionId": "pred-ref-mock-u827as",
  "matchId": "match-alpha-001",
  "competitionId": "competition-alpha",
  "seasonId": "season-alpha-2026",
  "generatedAt": "2026-06-23T22:58:00Z",
  "engineMode": "mock",
  "predictionAvailable": false,
  "confidenceLabel": "not_available",
  "outputSummary": "no owner-approved prediction algorithm is active",
  "trace": {
    "inputCandidateId": "candidate-alpha-001",
    "workerRunId": "run-alpha-001",
    "sourceProviderId": "provider-mock-alpha",
    "engineVersion": "1.0.0-mock"
  },
  "warnings": [
    "prediction_refused_no_algorithm_active"
  ]
}
```

---

## 3. Propagation Behavior
Even in a refusal state, the engine **must** propagate tracing references:
* The `warnings` array must append `"prediction_refused_no_algorithm_active"`.
* If the incoming `inputCandidate` contains validation warnings (e.g. `"odds_stale"`), they must be appended to the output `warnings` array.
* The API gateway must parse this envelope and pass it to the LLM explainer to trigger natural language refusal behavior.
