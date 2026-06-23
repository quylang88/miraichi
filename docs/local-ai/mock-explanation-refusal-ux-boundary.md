# Mock Explanation Refusal UX Boundary

* **Status**: Draft
* **Date**: June 23, 2026

---

## 1. Context & Purpose
When a user requests match rationales or chat explanations for fixtures that lack calculations, the application must handle the refusal gracefully in the UI. Wording must be deterministic and transparent, avoiding speculative language that implies a real prediction is running.

---

## 2. Refusal UX Requirements
* **Deterministic Display**:
  * If the chat response envelope indicates `explanationAvailable: false`, the chat interface must render the refusal text block exactly as returned by `apps/local-ai`.
* **Trace References**:
  * The UX must display the `predictionId` and `traceId` next to the refusal message to allow verification audits.
  * Wording: `"No prediction data is available because no owner-approved prediction algorithm is active. (Trace: pred-ref-mock-u827as)"`
* **Forbidden Implication**:
  * The UI must not use phrases like *"Our models are calculating results..."*, *"Estimating outcome..."*, or *"The prediction is loading..."*.
  * Wording must be explicitly clear that no calculation model is active.
