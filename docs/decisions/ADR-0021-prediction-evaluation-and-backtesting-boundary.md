# ADR-0021: Prediction Evaluation and Backtesting Boundary

* **Status**: Draft
* **Date**: 2026-06-23
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started
* **Note**: This ADR governs backtesting harness design and metric planning. It does not authorize betting wagers, bankroll adjustments, or risk/ROI calculations.

---

## 1. Context
To verify model feasibility, predictions must be evaluated against actual match results. However, creating final betting rules, ROI metrics, or bankroll wagers during the planning stage introduces extreme complexity and risks violating the project's strict separation of concerns.

## 2. Options Considered
* **Option A**: Build a comprehensive backtester that simulates user wagers and budget changes.
* **Option B (Recommended)**: Plan a candidate backtesting harness outline, deferring all bankroll/betting ROI logic.
* **Option C**: Postpone all evaluation planning until Phase 5 coding.

## 3. Decision & Recommendation
Recommend **Option B**. The system defines the shape of the backtesting evaluation harness. 

This covers backtesting harness shape only; no final metric, threshold, ROI, bankroll, stake, or betting evaluation logic is authorized in Phase 4. Candidate metrics (such as accuracy counts, coverage ratios, and trace verification) are listed for discussion only.

## 4. Consequences
* Simplifies developer evaluation setups.
* Keeps core prediction evaluation decoupled from bankroll strategy.
* Precludes AI models from writing high-risk financial code.

## 5. Risks
* Mock metric selections might need refactoring once real predictions are enabled.

## 6. Open Questions
* What is the threshold for a model to be considered "production ready" (e.g. minimum accuracy)?

## 7. Explicit Exclusions
* This ADR does NOT define final success metrics, bankroll rules, risk-limit formulas, or betting recommendation parameters.
* This ADR does NOT authorize simulating user wagering behaviors or financial tracking.
