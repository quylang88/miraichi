# Mock Prediction Engine Contract

* **Status**: Active
* **Date**: June 23, 2026

---

## 1. Endpoint Specification
* **Route**: POST `/ai/v1/predict`
* **Content-Type**: `application/json`
* **Role**: Receives normalized input candidates and outputs a traceable prediction envelope.

---

## 2. Input Candidate JSON Schema Details

```json
{
  "type": "object",
  "required": [
    "inputCandidateId",
    "matchId",
    "competitionId",
    "seasonId",
    "sourceProviderId",
    "ingestedAt",
    "freshnessStatus",
    "validationStatus",
    "availableMarkets",
    "dataQualityIssues",
    "trace"
  ],
  "properties": {
    "inputCandidateId": { "type": "string" },
    "matchId": { "type": "string" },
    "competitionId": { "type": "string" },
    "seasonId": { "type": "string" },
    "sourceProviderId": { "type": "string" },
    "ingestedAt": { "type": "string", "format": "date-time" },
    "freshnessStatus": { "type": "string", "enum": ["fresh", "stale", "delayed"] },
    "validationStatus": { "type": "string", "enum": ["passed", "failed"] },
    "availableMarkets": { "type": "array", "items": { "type": "string" } },
    "dataQualityIssues": { "type": "array", "items": { "type": "string" } },
    "trace": {
      "type": "object",
      "required": ["workerRunId", "adapterVersion"],
      "properties": {
        "workerRunId": { "type": "string" },
        "adapterVersion": { "type": "string" }
      }
    }
  }
}
```

---

## 3. Mock Prediction Envelope Schema Output

```json
{
  "type": "object",
  "required": [
    "predictionId",
    "matchId",
    "competitionId",
    "seasonId",
    "generatedAt",
    "engineMode",
    "predictionAvailable",
    "confidenceLabel",
    "outputSummary",
    "trace",
    "warnings"
  ],
  "properties": {
    "predictionId": { "type": "string" },
    "matchId": { "type": "string" },
    "competitionId": { "type": "string" },
    "seasonId": { "type": "string" },
    "generatedAt": { "type": "string", "format": "date-time" },
    "engineMode": { "type": "string" },
    "predictionAvailable": { "type": "boolean" },
    "confidenceLabel": { "type": "string" },
    "outputSummary": { "type": "string" },
    "trace": {
      "type": "object",
      "required": ["inputCandidateId", "workerRunId", "sourceProviderId", "engineVersion"],
      "properties": {
        "inputCandidateId": { "type": "string" },
        "workerRunId": { "type": "string" },
        "sourceProviderId": { "type": "string" },
        "engineVersion": { "type": "string" }
      }
    },
    "warnings": { "type": "array", "items": { "type": "string" } }
  }
}
```
