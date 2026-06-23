# Phase 4 Candidate ADRs

This document compiles the candidate Architectural Decision Records (ADRs) for Phase 4 (Local AI Input Pipeline and Prediction Engine Planning). These candidates must be reviewed, finalized, and approved by the project owner before implementing local AI models, runtimes, or mathematical prediction logic.

---

## ADR-0017: Local AI Input Candidate Boundary

* **Status**: Candidate
* **Date**: 2026-06-23

### Problem
`apps/local-ai` needs normalized input structures representing match and market conditions. Directly coupling model preprocessing to ingestion structures or raw sports data formats makes the AI engine fragile to raw schema adjustments and violates structural isolation rules.

### Options
* **Option A**: Allow `apps/local-ai` to directly access worker caches and raw provider schemas.
* **Option B (Recommended)**: Consume standard, generic input candidate objects derived from Phase 3 ingestion contracts.
* **Option C**: Set up a secondary normalization middleware layer between worker and local-ai.

### Recommended Direction
**Option B**. The local AI boundary consumes generic `inputCandidate` objects (defined in the handoff contract) that filter out provider details, ensuring the prediction engine remains competition-agnostic and decoupled from raw sports feed formats. No prediction algorithm is selected in this step.

Note: Input candidates are not predictions and must not contain owner-undecided model features, weights, betting signals, or strategy decisions.

### Risks
* Abstraction might hide granular features (e.g. detailed card stats) if not declared in the shared contracts.

### Open Questions
* How frequently should snapshots be generated for matches that are in-play vs pre-match?

### What It Must Not Decide Yet
* The final prediction model inputs, weights, or machine learning algorithms.

### Owner Approval Required
* Yes. Requires owner signature to authorize input boundary structure.

---

## ADR-0018: Prediction Output Envelope and Trace Contract

* **Status**: Candidate
* **Date**: 2026-06-23

### Problem
Predictions must be consumable by the API gateway and the frontend UI, while remaining verifiable and auditable. Ad-hoc prediction outputs lack metadata, making it impossible to trace an outcome back to the ingestion run or verify why a model behaved a certain way.

### Options
* **Option A**: Output loose outcomes (e.g. simple home/away win flags) without audit fields.
* **Option B (Recommended)**: Output a traceable envelope containing metadata, warnings, and execution metrics.
* **Option C**: Store predictions directly in a shared repository and return database IDs only.

### Recommended Direction
**Option B**. The prediction engine outputs a traceable envelope schema containing:
`predictionId`, `matchId`, `competitionId`, `seasonId`, `generatedAt`, `engineMode`, `predictionAvailable`, `confidenceLabel`, `outputSummary`, `trace`, and `warnings`.
No probability calculation formulas or decimal ratios are defined in this candidate.

Note: Outcome labels, recommended bets, stake fields, confidence percentages, or probability fields require later owner-approved ADR.

### Risks
* Slightly increased data transfer size due to trace telemetry.

### Open Questions
* Should we track CPU/GPU execution time in the warning list to detect model degradation?

### What It Must Not Decide Yet
* The mathematical probability formulas, confidence thresholds, or outcome calculations.

### Owner Approval Required
* Yes. Requires owner signature to finalize prediction format.

---

## ADR-0019: Prediction Engine Runtime and Algorithm Selection Boundary

* **Status**: Candidate
* **Date**: 2026-06-23

### Problem
Selecting a prediction runtime (e.g. ONNX, TensorFlow, PyTorch) too early can lock the project into complex dependencies, bloating the repository and adding configuration friction before simple data flow is validated.

### Options
* **Option A**: Deploy PyTorch with local Python microservice communication immediately.
* **Option B**: Code heuristic mathematical rules directly into the worker poller.
* **Option C (Recommended)**: Defer final runtime and algorithm selection. Implement a mock prediction engine only.

### Recommended Direction
**Option C**. Runtime, model, and algorithm selections remain deferred. Phase 4 may implement a mock prediction engine that returns traceable mock envelopes only. It must not return real outcome predictions, betting picks, probability percentages, or confidence scores. The safest default is `predictionAvailable: false` or `engineMode: mock`. Real prediction logic is completely frozen until the owner signs off on a baseline evaluation report.

### Risks
* Postpones the discovery of potential hardware performance issues or model loading errors.

### Open Questions
* Will CPU-only environments (e.g., standard serverless workers) support the selected runtime without latency penalties?

### What It Must Not Decide Yet
* The specific AI framework, model file formats, weights, or code dependencies.

### Owner Approval Required
* Yes. Requires owner signature before any non-mock runtime is added.

---

## ADR-0020: LLM Explanation Role and Prediction Refusal Boundary

* **Status**: Candidate
* **Date**: 2026-06-23

### Problem
LLMs are prone to hallucinating facts or guessing sports match outcomes. In a betting tool, a hallucinated prediction or false rationale can lead to incorrect user wagers and severe financial/analytical errors.

### Options
* **Option A**: Allow the LLM to speculate on matches using general internet knowledge or historical stats.
* **Option B (Recommended)**: Restrict the LLM to explaining pre-calculated local AI prediction envelopes only, requiring it to refuse when no envelope exists.
* **Option C**: Prevent LLM participation entirely and use hardcoded template strings for UI rationales.

### Recommended Direction
**Option B**. The LLM operates strictly as an explainer of traceable local-ai predictions. If the prediction is missing or `predictionAvailable` is `false`, the LLM must refuse or clarify the lack of data. It must never speculate or invent outcomes.

Note: Explanations should reference `predictionId` or `traceId` when available.

### Risks
* Users may find a refusal message frustrating if they expect general chatbot capabilities.

### Open Questions
* What fallback prompts should the LLM use when partial matches are found?

### What It Must Not Decide Yet
* The specific LLM models, system prompts, temperature parameters, or token limits.

### Owner Approval Required
* Yes. Requires owner signature to enforce LLM refusal criteria.

---

## ADR-0021: Prediction Evaluation and Backtesting Boundary

* **Status**: Candidate
* **Date**: 2026-06-23

### Problem
To evaluate if a prediction model is viable, we must test it against historical match outcomes. However, designing bankroll adjustments or betting ROI tracking at this stage introduces high complexity and risks violating owner governance limits.

### Options
* **Option A**: Code bankroll and Kelly Criterion logic directly into the AI engine.
* **Option B (Recommended)**: Plan a candidate backtesting harness outline, deferring all bankroll/betting ROI logic.
* **Option C**: Postpone evaluation planning entirely until Phase 5.

### Recommended Direction
**Option B**. Define the metrics shape and harness layout for backtesting evaluation. Candidate metrics may be listed for discussion only, such as accuracy-like counts, coverage, calibration notes, or trace completeness. No metric is final, no threshold is accepted, and no betting ROI, bankroll, or stake-based evaluation is authorized in Phase 4. Success metrics remain candidates (e.g. simple accuracy ratio) and no ROI, bankroll logic, or betting rules are coded.

### Risks
* Early metric definitions might not align with the needs of more complex prediction engines.

### Open Questions
* What dataset size is required to achieve statistical significance in our backtesting?

### What It Must Not Decide Yet
* Final model success thresholds, bankroll rules, risk-limit formulas, or betting recommendation parameters.

### Owner Approval Required
* Yes. Requires owner signature to authorize the evaluation framework.
