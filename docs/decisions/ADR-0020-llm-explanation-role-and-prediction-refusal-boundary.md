# ADR-0020: LLM Explanation Role and Prediction Refusal Boundary

* **Status**: Draft
* **Date**: 2026-06-23
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started
* **Note**: This ADR governs LLM natural language explanation boundaries. It does not authorize speculative chat predictions, database integration, or active external API calls.

---

## 1. Context
LLMs are capable of generating fluent rationales but are prone to hallucinating predictions, facts, or betting tips. Allowing the LLM to speculate or formulate outcomes on matches without baseline data compromises system integrity and risks user bankroll safety.

## 2. Options Considered
* **Option A**: Allow the LLM to speculate on match outcomes using general football knowledge.
* **Option B (Recommended)**: Restrict the LLM to explaining pre-calculated local AI prediction output envelopes, requiring it to refuse the request if the envelope is missing or unavailable.
* **Option C**: Eliminate the LLM layer entirely and use hardcoded explanation templates in the client UI.

## 3. Decision & Recommendation
Recommend **Option B**. The LLM functions strictly as an explainer of pre-calculated local prediction envelopes. 

The LLM explains only traceable local-ai envelopes and refuses/clarifies when the envelope is missing or `predictionAvailable` is `false`. It must not generate speculative predictions. Explanations must reference the associated `predictionId` or `traceId` when available.

## 4. Consequences
* Prevents hallucinated or unauthorized match predictions.
* Enforces strict, safe user interfaces that decline speculation.
* Decouples natural language explanation generation from statistical inference.

## 5. Risks
* Users may expect a general football discussion bot and find the rigid refusal behavior frustrating.

## 6. Open Questions
* What is the fallback response template for matches with incomplete provider stats?

## 7. Explicit Exclusions
* This ADR does NOT select the LLM model size, prompt tuning parameters, or local model execution backend.
* This ADR does NOT authorize the LLM to suggest betting tips, wagers, or risk sizes.
