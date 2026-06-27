# LLM Explanation Boundary

* **Status**: Active
* **Date**: June 23, 2026

---

## 1. Role of the LLM
The LLM (Large Language Model) within the Miraichi architecture functions strictly as a natural language mediator and explainer of pre-calculated prediction data. It does **not** evaluate probabilities, calculate match outcomes, perform statistical inference, or formulate betting strategies.

---

## 2. Refusal and Invention Boundaries
* **No Speculation**: The LLM must not invent match outcomes, scores, or predictions if no corresponding local AI prediction output exists in the context.
* **Mandatory Refusal**: If a user asks for a prediction on a match where `predictionAvailable` is `false` or the prediction record is missing, the LLM must refuse to answer. It should output a structured refusal message (e.g., `"No prediction data is currently available for this match. I cannot speculate on the outcome."`).
* **Source Coupling**: The LLM must only summarize and explain the metrics contained within the traceable `Prediction Output Envelope`. It is prohibited from referencing external sports data or historical real-world football facts not provided in the prompt context.

---

## 3. Explanation Context Template
When sending a request to the LLM explainer in `apps/local-ai`, the system must wrap the inputs in a structured context template:

```
[SYSTEM INSTRUCTION]
You are a translation assistant explaining local prediction outputs.
Explain only the provided prediction data.
Do not invent predictions, probabilities, or statistics.
If prediction data is missing or predictionAvailable is false, refuse the request.
Keep responses concise, neutral, and competition-agnostic.

[PREDICTION ENVELOPE]
{
  "predictionId": "pred-alpha-998877",
  "matchId": "match-alpha-001",
  "predictionAvailable": true,
  "confidenceLabel": "mock-medium",
  "outputSummary": "Outcome leans home advantage based on mock data."
}

[USER QUERY]
"Can you explain the prediction for match-alpha-001?"
```

---

## 4. Forbidden LLM Output Content
The LLM must be constrained via system prompts to ensure it never output:
* Betting advice (e.g. "I recommend betting on the home team").
* Risk metrics or investment suggestions (e.g. "This is a safe bet with low risk").
* Unverified stats or probability percentages (e.g. "There is a 75% chance of victory").
