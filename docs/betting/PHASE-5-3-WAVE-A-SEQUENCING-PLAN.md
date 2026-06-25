# Phase 5.3 Wave A Sequencing Plan

This document recommends future implementation order. It does not authorize implementation.

---

## 1. Sequencing Principle

Build future work from lowest-risk technical foundations toward user-visible surfaces:

1. Tooling.
2. Shared contracts.
3. Config boundaries.
4. Navigation shell.
5. Persistence planning execution.
6. Later business logic waves.

This order reduces contract drift and prevents UI or storage code from forcing unapproved formulas, provider choices, or framework decisions.

---

## 2. Recommended Future Sequence

### Phase 5.4: TypeScript Tooling Setup Plan Execution

**Future objective:** Add TypeScript tooling only after owner approval.

**Future scope after approval:**

* Add TypeScript dependency.
* Add approved `tsconfig` structure.
* Add approved typecheck command.
* Keep app migration blocked.

**Blocked until approval:**

* TypeScript installation.
* `tsconfig` files.
* JS-to-TS migration.
* Framework selection.

### Phase 5.5: Typed Shared Domain Contracts

**Future objective:** Add shared typed domain contracts after TypeScript tooling is approved.

**Future scope after approval:**

* `BetRecordEnvelope` type.
* `MatchBettingGroup` type.
* Market and odds types.
* No formulas.
* Runtime validation remains separate.

**Blocked until approval:**

* Contract files.
* Validators.
* Calculations.
* App migration.

### Phase 5.6: Market Catalog and Line Preset Config

**Future objective:** Add config-only market catalog and line presets.

**Future scope after approval:**

* V1 market definitions.
* Line preset definitions.
* Warning metadata for non-0.25 line values.
* Manual line entry support metadata.

**Blocked until approval:**

* Settlement formulas.
* Hard-block validators.
* Market-specific calculations.

### Phase 5.7: PWA Navigation Shell Alignment

**Future objective:** Align the web app shell to the accepted five-tab backbone.

**Future scope after approval:**

* `Today`, `Matches`, `Bets`, `Bankroll`, `Miraichi` shell.
* Placeholder/safe views only.
* `Add Bet` as primary action.

**Blocked until approval:**

* Final UI implementation.
* Real AI cards.
* Router implementation before framework/tooling decisions.
* Calculations.

### Phase 5.8: Local-First Persistence Planning Execution

**Future objective:** Start persistence execution only after a specific owner-approved storage plan.

**Future scope after approval:**

* Persistence adapter skeleton if approved.
* IndexedDB adapter later.
* Export/import later.

**Blocked until approval:**

* IndexedDB implementation.
* Export/import code.
* Storage libraries.
* DB/ORM/schema/migration.
* Auth or cloud sync.

### Later Wave

The following require separate ADRs and owner approvals:

* Stake/P&L formulas.
* Settlement formulas.
* Reporting aggregation.
* AI recommendation boundary implementation.
* Bankroll/risk warnings.
* Real data provider integration.
* Dataset and evaluation planning.
* Model training and prediction engine R&D.

---

## 3. Phase 5.3 Deliverable Order

Phase 5.3 planning deliverables should be reviewed in this order:

1. `PHASE-5-3-WAVE-A-IMPLEMENTATION-PLAN.md`
2. `PHASE-5-3-WAVE-A-TECHNICAL-SCOPE.md`
3. `PHASE-5-3-WAVE-A-SEQUENCING-PLAN.md`
4. `PHASE-5-3-WAVE-A-IMPLEMENTATION-GUARDRAILS.md`
5. `PHASE-5-3-WAVE-A-OPEN-QUESTIONS.md`
6. `PHASE-5-3-WAVE-A-READINESS-REVIEW.md`

---

## 4. Next Gate

Phase 5.4 may be proposed next only as a TypeScript tooling setup execution plan. It must still receive owner approval before any dependency or config file is added.
