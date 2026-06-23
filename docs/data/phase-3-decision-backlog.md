# Phase 3 Decision Backlog

Tracks unresolved architectural, data model, and ingestion decisions during Phase 3 planning.

---

## 1. Decision Backlog Table

| Ref | Decision Topic | Status | Recommended Revisit Phase | Blocking Phase | Target Resolution Owner | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PH3-DEC-013** | Storage Responsibility & Database | Deferred | Phase 3 (Planning) | Phase 3 (Scaffold Code) | Architect & Backend Agents | Evaluates SQL vs JSON storage options. No schemas or clients are configured until the related ADR is accepted. |
| **PH3-DEC-014** | Data Provider Selection & Abstraction | Deferred | Phase 3 (Planning) | Phase 3 (Ingestion Code) | Product Research Agent | Identifies final sports data feed vendor and connectivity schema parameters. |
| **PH3-DEC-015** | Generic Football Data Contract | Deferred | Phase 3 (Planning) | Phase 3 (Normalization Code) | Architect & Frontend Agents | Maps multi-provider feed shapes into unified TypeScript type definitions. |
| **PH3-DEC-016** | Ingestion Quality & Traceability | Deferred | Phase 3 (Planning) | Phase 3 (Ingestion Code) | QA & Backend Agents | Defines threshold limits for stale odds, validation schemas, and historical data backup. |

---

## 2. Governance Rules

1. **Gatekeepers**: No items on this backlog may be resolved directly in implementation code. They must be promoted to **Accepted** status in an ADR file first.
2. **Execution Blocks**: The codebase remains locked and cannot commit database dependencies, live HTTP connectors, or real API credentials until the corresponding candidate ADRs are approved and accepted.
3. **Traceability**: Decisions must remain competition-agnostic, using generic data examples throughout.
