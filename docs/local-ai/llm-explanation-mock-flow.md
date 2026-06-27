# LLM Explanation Mock Flow

* **Status**: Active
* **Date**: June 23, 2026

---

## 1. Explanation Workflow
When natural language explanation is requested (e.g. through the chat endpoint `/api/v1/chat`), the API gateway fetches the traceable prediction envelope and passes it to the LLM explainer endpoint `/ai/v1/explain` inside `apps/local-ai`:

```mermaid
graph TD
    A[User Chat Request] -->|GET /predictions/:id/explain| B(apps/api Gateway)
    B -->|Fetch Prediction Envelope| C(apps/local-ai Mock predict endpoint)
    C -->|Return envelope: predictionAvailable = false| B
    B -->|POST /ai/v1/explain with envelope| D(apps/local-ai LLM Explainer)
    Note over D: LLM checks predictionAvailable status
    D -->|True: Explain rationale| E[Explanation Output]
    D -->|False: Refuse speculation| F[Refusal Text Output]
    F -->|Return message| B
    B -->|Present refusal| A
```

---

## 2. Refusal Prompt Template
The system prompt rules require the LLM to inspect `predictionAvailable` and refuse if it is false:

```
[SYSTEM INSTRUCTION]
You are a prediction explainer. You have access to a local prediction payload.
If the prediction envelope has predictionAvailable set to false, you MUST refuse to explain or speculate on the match outcome.
Return a concise, neutral message clarifying that no prediction algorithm is currently active.

[PREDICTION DATA]
{
  "predictionId": "pred-ref-mock-u827as",
  "matchId": "match-alpha-001",
  "predictionAvailable": false,
  "confidenceLabel": "not_available",
  "outputSummary": "no owner-approved prediction algorithm is active",
  "trace": { "predictionId": "pred-ref-mock-u827as" }
}

[LLM OUTPUT RESPONSE]
"No prediction data is available for match-alpha-001 because no owner-approved prediction algorithm is active. I cannot speculate on this match outcome. (Trace: pred-ref-mock-u827as)"
```
