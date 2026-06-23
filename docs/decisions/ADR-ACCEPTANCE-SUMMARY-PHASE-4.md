# Phase 4 ADR Acceptance Summary

* **Date**: June 23, 2026
* **Status**: Accepted
* **Implementation Status**: Not started

---

## 1. Overview
The project owner has reviewed, finalized, and accepted Architectural Decision Records (ADRs) **ADR-0017** through **ADR-0021** on June 23, 2026. This summary documents what has been officially unlocked for Phase 4 implementation, what remains strictly forbidden, and the next steps.

---

## 2. Accepted ADRs & What They Unlock

### [ADR-0017: Local AI Input Candidate Boundary](file:///c:/CODE/miraichi/docs/decisions/ADR-0017-local-ai-input-candidate-boundary.md)
* **Unlocks**: Extracting and formatting normalized input snapshots from the worker cache to feed into `apps/local-ai`.
* **Details**: Ensures input candidates filter out raw provider details and remain strictly competition-agnostic. No prediction model features or weights are selected.

### [ADR-0018: Prediction Output Envelope and Trace Contract](file:///c:/CODE/miraichi/docs/decisions/ADR-0018-prediction-output-envelope-and-trace-contract.md)
* **Unlocks**: Structuring prediction outputs into standard traceable envelopes containing execution context, status tags, plain-text summaries, and audit trace links.
* **Details**: Guarantees debug lineage from initial sports feed to final prediction without specifying mathematical probability formulas.

### [ADR-0019: Prediction Engine Runtime and Algorithm Selection Boundary](file:///c:/CODE/miraichi/docs/decisions/ADR-0019-prediction-engine-runtime-and-algorithm-selection-boundary.md)
* **Unlocks**: Scaffolding a **mock prediction engine** in `apps/local-ai` returning static envelopes with mock metadata.
* **Details**: Defers ONNX/TensorFlow/PyTorch execution and model weight imports. The mock engine must not calculate real odds, percentages, or wagers.

### [ADR-0010: LLM Explanation Role and Prediction Refusal Boundary](file:///c:/CODE/miraichi/docs/decisions/ADR-0020-llm-explanation-role-and-prediction-refusal-boundary.md)
* **Unlocks**: Coding the LLM explainer prompts in `apps/local-ai` to translate prediction envelope payloads into natural language.
* **Details**: The LLM must not guess or speculate on matches, and must refuse to respond when predictions are missing or `predictionAvailable` is `false`.

### [ADR-0021: Prediction Evaluation and Backtesting Boundary](file:///c:/CODE/miraichi/docs/decisions/ADR-0021-prediction-evaluation-and-backtesting-boundary.md)
* **Unlocks**: Planning the backtesting harness layout and listing evaluation metrics for discussion.
* **Details**: Strictly forbids coding betting stake logic, Kelly Criterion allocations, or budget ROI tracking.

---

## 3. What Remains Forbidden
* **No Prediction Algorithms**: Do not write machine learning models, heuristics, neural networks, or active statistical classifiers.
* **No Probability Math**: Do not implement mathematical functions estimating odds ratios, outcome likelihoods, or draw percentages.
* **No Betting/Bankroll Logic**: No Kelly Criterion, stake sizing, loss limiters, or betting slips.
* **No Real AI Runtimes or Weights**: Do not install ONNX/PyTorch packages or download model binaries.
* **No DB/Provider/Secrets**: No database schemas, ORM integrations, Sportmonks API feeds, or credential configs.
* **No Tournament Hardcodes**: Keep all schemas, mock scripts, and examples competition-agnostic. No hardcoded references to real tournaments (World Cup, FIFA) or team names.

---

## 4. Owner-Controlled Decisions Still Deferred
* Final select of the database storage engine.
* Production sports feed API vendor contract.
* Machine learning model runtime framework and LLM size/engine.
* Final model success metric thresholds.
* Betting bankroll rules, risk wagers, and daily loss caps.

---

## 5. Next Recommended Step
* **Phase 4.2 - Mock Local AI Prediction Pipeline Planning**
  * **Goal**: Scaffold the mock endpoints inside `apps/local-ai` (specifically `/ai/v1/predict` and `/ai/v1/explain`) returning static traceable envelopes, and verify that metadata traces propagate successfully through the API gateway.
