# Phase 3.2 Data Contract Plan

* **Status**: Draft
* **Date**: 2026-06-23

---

## 1. Purpose
Details the execution roadmap for deploying the mock data contracts within packages/shared and apps/worker.

## 2. Scope
Guides the implementation details of the contract skeletons during Phase 3.3.

## 3. Plan Sections
1. **Define Markdown contracts**: Document matches, markets, adapters, and run schemas (Phase 3.2 complete).
2. **Define JS mock objects**: Create mock schema templates in `packages/shared`.
3. **Build Mock Adapter**: Implement `MockProviderAdapter` mapping local JSON files.
4. **Scaffold Poller Job**: Implement transient in-memory run loops to process mocks.

## 4. Required Files List
* `docs/data/generic-football-data-contract.md`
* `docs/data/normalized-match-contract.md`
* `docs/data/normalized-market-contract.md`
* `docs/data/provider-adapter-contract.md`
* `docs/data/ingestion-run-contract.md`
* `docs/data/mock-ingestion-flow.md`
* `docs/data/phase-3-contract-review-checklist.md`

## 5. Optional Future Work
* Relational database SQL table schemas mapping these contracts.

## 6. Example Mock Configuration
```json
{
  "activePlan": "phase-3-2-data-contract-plan",
  "nextMilestone": "phase-3-3-mock-ingestion-skeleton"
}
```

## 7. Validation Notes
* All files in Section 4 must exist and pass verification gates before mock skeleton code begins.

## 8. What It Must Not Decide Yet
* Selection of database drivers, connection pooling settings, or schema migrations.
