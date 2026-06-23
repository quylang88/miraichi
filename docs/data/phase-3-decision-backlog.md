# Phase 3 Decision Backlog

Tracks unresolved architectural, data model, and ingestion decisions during Phase 3 planning.

---

## 1. Decision Backlog Table

| Ref | Decision Topic | Status | Recommended Revisit Phase | Blocking Phase | Target Resolution Owner | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PH3-DEC-013** | Storage Responsibility & Database | Accepted / Resolved | Phase 3 (Planning) | Phase 3 (Scaffold Code) | Architect & Backend Agents | Option A accepted. Purely in-memory and mock JSON stubs are authorized for Phase 3 ingestion planning (ADR-0013). |
| **PH3-DEC-014** | Data Provider Selection & Abstraction | Accepted / Resolved | Phase 3 (Planning) | Phase 3 (Ingestion Code) | Product Research Agent | Option B accepted. Provider-agnostic adapter interface maps hypothetical vendors (ADR-0014). |
| **PH3-DEC-015** | Generic Football Data Contract | Accepted / Resolved | Phase 3 (Planning) | Phase 3 (Normalization Code) | Architect & Frontend Agents | Option B accepted. Documentation-first markdown contracts and JS mock objects in packages/shared; TS deferred (ADR-0015). |
| **PH3-DEC-016** | Ingestion Quality & Traceability | Accepted / Resolved | Phase 3 (Planning) | Phase 3 (Ingestion Code) | QA & Backend Agents | Option B accepted. Boundary quality parsing and metadata tracing parameters authorized (ADR-0016). |

---

## 2. Governance Rules

1. **Gatekeepers**: No items on this backlog may be resolved directly in implementation code. They must be promoted to **Accepted** status in an ADR file first.
2. **Execution Blocks**: The codebase remains locked and cannot commit database dependencies, live HTTP connectors, or real API credentials until the corresponding candidate ADRs are approved and accepted.
3. **Traceability**: Decisions must remain competition-agnostic, using generic data examples throughout.
