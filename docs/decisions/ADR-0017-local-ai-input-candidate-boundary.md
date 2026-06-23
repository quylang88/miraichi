# ADR-0017: Local AI Input Candidate Boundary

* **Status**: Accepted
* **Date**: 2026-06-23
* **Accepted Date**: 2026-06-23
* **Owner Approval**: Approved by project owner
* **Implementation Status**: Not started
* **Note**: This ADR guides Phase 4 mock local-ai planning and does not authorize real prediction algorithms, probability formulas, betting recommendations, bankroll logic, risk logic, model runtimes, or LLM provider integration.

---

## 1. Context
The local AI service (`apps/local-ai`) requires normalized snapshots of football fixtures and odds to run statistical inference. Directly coupling the inference logic to raw feed provider formats or database caching models creates a fragile architecture that breaks when feed schema changes occur. Standardizing the interface at the input boundary ensures competition agnosticism and strict separation of concerns.

## 2. Options Considered
* **Option A**: Allow `apps/local-ai` to read directly from database caches and handle provider API normalization internally.
* **Option B (Recommended)**: Define a standardized, generic input candidate contract mapping only the raw match and market snapshot fields.
* **Option C**: Set up a secondary middleware service that performs feature engineering before delivering data to `apps/local-ai`.

## 3. Decision & Recommendation
Recommend **Option B**. The local AI boundary consumes generic `inputCandidate` snapshot payloads. Ingestion components normalize provider inputs and validate basic criteria at the worker boundary before formatting them into this contract. 

Input candidates are not predictions and cannot include owner-undecided model features, weights, betting signals, or strategy decisions.

## 4. Consequences
* Isolates `apps/local-ai` from provider feed variations.
* Keeps the prediction input pipeline fully competition-agnostic.
* Simplifies unit testing by using static JSON input candidates.

## 5. Risks
* If new features (e.g. detailed statistics) are required by future algorithms, the shared handoff contract must be updated.

## 6. Open Questions
* How frequently should input candidate snapshots be updated for active in-play matches?

## 7. Explicit Exclusions
* This ADR does NOT select prediction models, algorithms, runtime frameworks, or model weights.
* This ADR does NOT authorize the inclusion of user bankroll data, betting stakes, or betting recommendation signals in the input candidate.
