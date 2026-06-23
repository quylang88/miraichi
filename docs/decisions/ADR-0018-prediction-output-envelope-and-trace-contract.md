# ADR-0018: Prediction Output Envelope and Trace Contract

* **Status**: Accepted
* **Date**: 2026-06-23
* **Accepted Date**: 2026-06-23
* **Owner Approval**: Approved by project owner
* **Implementation Status**: Not started
* **Note**: This ADR guides Phase 4 mock local-ai planning and does not authorize real prediction algorithms, probability formulas, betting recommendations, bankroll logic, risk logic, model runtimes, or LLM provider integration.

---

## 1. Context
Predictions must be consumable by the API gateway and natural language explanation layers, while remaining fully auditable. Ad-hoc prediction structures make it difficult to trace an outcome back to the ingestion run, the provider feed state, or the model version, making debugging and verification impossible.

## 2. Options Considered
* **Option A**: Output loose outcome predictions (e.g., boolean indicators) without tracing metadata.
* **Option B (Recommended)**: Output a structured, traceable prediction envelope containing execution context, confidence labels, plain text summaries, and lineage trace references.
* **Option C**: Write predictions directly to the database and return database record IDs only.

## 3. Decision & Recommendation
Recommend **Option B**. The local AI prediction engine outputs a standard envelope schema containing:
* `predictionId`, `matchId`, `competitionId`, `seasonId`, `generatedAt`, `engineMode`, `predictionAvailable`, `confidenceLabel`, `outputSummary`, `trace` (referencing `inputCandidateId`, `workerRunId`, `engineVersion`), and `warnings`.

The envelope must be traceable but must not define probability formulas, confidence percentages, betting picks, stake fields, or outcome labels unless later owner-approved.

## 4. Consequences
* Ensures absolute audit lineage from the sports feed to the final explanation.
* Standardizes prediction consumption across the monorepo.
* Simplifies QA audits by providing deterministic verification checkpoints.

## 5. Risks
* Telemetry overhead increases payload size slightly.

## 6. Open Questions
* Should we log hardware metrics (e.g. CPU inference duration) in the envelope trace block?

## 7. Explicit Exclusions
* This ADR does NOT define mathematical models or statistical probability functions.
* This ADR does NOT authorize the calculation of value wagers or bankroll allocation stakes.
