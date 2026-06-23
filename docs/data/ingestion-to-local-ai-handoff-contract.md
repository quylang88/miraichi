# Ingestion to Local AI Handoff Contract

* **Status**: Draft
* **Date**: 2026-06-23

---

## 1. Purpose
Defines the schema contract for feeding normalized match/odds candidate inputs from the ingestion mediation layers into the local AI statistics processing engine (`apps/local-ai`) for Phase 4.

---

## 2. Handoff Contract Specification

### Required Fields
* `inputCandidateId`: Unique ID representing this specific handoff data snapshot.
* `matchId`: Generic fixture ID (e.g. `match-alpha-001`).
* `competitionId`: Generic tournament ID (e.g. `competition-alpha`).
* `seasonId`: Generic season ID (e.g. `season-alpha-2026`).
* `sourceProviderId`: Source tracker string (e.g. `provider-mock-alpha`).
* `ingestedAt`: ISO-8601 UTC timestamp indicating when the match was parsed.
* `freshnessStatus`: Indicator of data latency (e.g. `fresh`, `stale`, `delayed`).
* `validationStatus`: Result state of validator check (e.g. `passed`, `failed`).
* `availableMarkets`: Array of normalized market names mapped (e.g. `["1X2"]`).
* `dataQualityIssues`: Array of warnings logged by validator (empty if fully valid).
* `trace`: Nested audit metadata containing:
  * `workerRunId`: Ingestion run identifier.
  * `adapterVersion`: Parser adapter code version.

### Optional Fields
* `metadata`: Dynamic provider tags.

---

## 3. Example Mock Handoff Payload
```json
{
  "inputCandidateId": "candidate-alpha-001",
  "matchId": "match-alpha-001",
  "competitionId": "competition-alpha",
  "seasonId": "season-alpha-2026",
  "sourceProviderId": "provider-mock-alpha",
  "ingestedAt": "2026-06-23T22:23:56Z",
  "freshnessStatus": "fresh",
  "validationStatus": "passed",
  "availableMarkets": [
    "1X2"
  ],
  "dataQualityIssues": [],
  "trace": {
    "workerRunId": "run-alpha-001",
    "adapterVersion": "1.0.0-mock"
  }
}
```

---

## 4. Strict Exclusions (Forbidden Business Logic)
To comply with the owner decision gates, this contract does NOT define:
* **Prediction Algorithms**: No probability formulas, neural network inputs, or statistical variables.
* **Model Scoring**: No model confidence weights or outcome classifications.
* **Betting Logic**: No betting recommendations, market selections, or odds value ratings.
* **Bankroll & Risk Limit Control**: No budget allocations, stake sizes, budget caps, or risk indicators.
