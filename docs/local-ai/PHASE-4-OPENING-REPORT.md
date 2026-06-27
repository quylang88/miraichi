# Phase 4 Opening Report: Local AI Input Pipeline and Prediction Engine Planning

* **Date**: June 23, 2026
* **Phase Name**: Phase 4 - Local AI Input Pipeline and Prediction Engine Planning
* **Status**: Completed

---

## 1. Context & Background
Phase 3 (Data Ingestion Planning and Mock Ingestion Skeleton) has been successfully completed and approved.
Phase 3 successfully delivered:
* Standardized, generic football data contracts (matches, markets, ingestion runs).
* Mock ingestion scheduler loop in the worker application reading static provider JSON fixtures.
* Worker/API/Local-AI handoff boundaries and snapshot contracts.
* Memory-only mock ingestion repository and lineage tracing.
* Verification script passing all criteria.

Phase 4 moves downstream to establish the **Local AI Input Pipeline and Prediction Engine** planning and decision boundaries. 

---

## 2. Phase 4 Goals & Objectives
The primary objective of Phase 4 is to plan the ingestion interfaces, inference input structures, prediction output contracts, traceability controls, and LLM explanation rules for the prediction engine.
* Define candidate input datasets extracted from normalized matches and markets.
* Establish standard prediction output envelopes containing audit and traceability metrics.
* Specify the role of local AI models/LLMs versus rule-based filters.
* Prevent premature technology lock-in by drafting candidate ADRs for owner review before any coding or mathematical calculations begin.

---

## 3. Reference Documents
Development in this phase relies on the following structural foundation:
* [docs/data/PHASE-3-COMPLETION-REPORT.md](file:///c:/CODE/miraichi/docs/data/PHASE-3-COMPLETION-REPORT.md)
* [docs/data/ingestion-to-local-ai-handoff-contract.md](file:///c:/CODE/miraichi/docs/data/ingestion-to-local-ai-handoff-contract.md)
* [docs/data/generic-football-data-contract.md](file:///c:/CODE/miraichi/docs/data/generic-football-data-contract.md)
* [docs/data/normalized-match-contract.md](file:///c:/CODE/miraichi/docs/data/normalized-match-contract.md)
* [docs/data/normalized-market-contract.md](file:///c:/CODE/miraichi/docs/data/normalized-market-contract.md)
* [docs/data/ingestion-run-contract.md](file:///c:/CODE/miraichi/docs/data/ingestion-run-contract.md)
* [docs/governance/OWNER-DECISION-GATES.md](file:///c:/CODE/miraichi/docs/governance/OWNER-DECISION-GATES.md)
* [docs/decisions/ADR-0013-storage-responsibility-and-phase-3-persistence-boundary.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0013-storage-responsibility-and-phase-3-persistence-boundary.md)
* [docs/decisions/ADR-0014-data-provider-abstraction-and-source-selection-criteria.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0014-data-provider-abstraction-and-source-selection-criteria.md)
* [docs/decisions/ADR-0015-generic-football-data-contract.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0015-generic-football-data-contract.md)
* [docs/decisions/ADR-0016-ingestion-quality-freshness-and-traceability-boundary.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0016-ingestion-quality-freshness-and-traceability-boundary.md)

---

## 4. Owner Governance & Decision Gates
Pursuant to [OWNER-DECISION-GATES.md](file:///c:/CODE/miraichi/docs/governance/OWNER-DECISION-GATES.md), the project owner retains final approval authority over all core logic, models, and algorithms. No implementation of business logic, prediction algorithms, risk rules, bankroll rules, or betting guidelines is authorized without an approved ADR.

This planning phase addresses:
1. **ADR-0017**: Local AI Input Candidate Boundary
2. **ADR-0018**: Prediction Output Envelope and Trace Contract
3. **ADR-0019**: Prediction Engine Runtime and Algorithm Selection Boundary
4. **ADR-0020**: LLM Explanation Role and Prediction Refusal Boundary
5. **ADR-0021**: Prediction Evaluation and Backtesting Boundary

---

## 5. Strict Exclusions (Forbidden Items)
To preserve the scoping guardrails of Phase 4 planning, the following items are strictly forbidden:
* **No Prediction Algorithms**: Do not implement neural network layers, linear regressions, heuristic weights, or probabilistic scoring code.
* **No Probability Calculations**: Do not implement mathematical functions estimating draw percentages, goal frequencies, or team performance values.
* **No Confidence Scoring**: Do not code confidence or value formulas.
* **No Betting/Bankroll/Risk Rules**: Do not write stake sizing, Kelly Criterion, loss caps, or betting advice code.
* **No Real AI Runtimes or Weights**: Do not install ONNX, TensorFlow, PyTorch, Llama.cpp, or load any `.onnx`/`.bin`/`.gguf` files.
* **No External LLM Calls**: Do not integrate OpenAI, Anthropic, Gemini, or other cloud APIs.
* **No Database or ORMs**: Do not install DB drivers, Sequelize, Prisma, Drizzle, or write DB schemas.
* **No Competition-Specific Code**: No hardcoded references to World Cup, real teams, real leagues, or real tournaments. Keep all examples generic and competition-agnostic.
