# Phase 2 Decision Backlog

This backlog tracks unresolved architectural and operational decisions for the Miraichi project during Phase 2 (App Skeleton and Scaffold Planning).

---

## 1. Decision Backlog Table

| Ref | Decision Topic | Status | Recommended Revisit Phase | Blocking Phase | Target Resolution Owner | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PH2-ADR-0003** | **ADR-0003 Product Boundary** | Proposed | Phase 2 (Early Planning Gateway) | Phase 2 (Scaffolding Code) | Project Owner | Needs approval of Option B (Read-only bet history stubs) in [ADR-0003-PHASE-2-OWNER-REVIEW.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0003-PHASE-2-OWNER-REVIEW.md). |
| **PH2-DEC-001** | **Storage Responsibility & Database** | Deferred | Phase 2 (Mid-Planning) | Phase 3 (Data Ingestion) | Architect & Backend Agents | Select SQLite, PostgreSQL, or Mongo for fixture data, and write schemas. |
| **PH2-DEC-002** | **Security, Secrets, & Privacy** | Deferred | Phase 2 (Late-Planning) | Phase 6 (Testing/Deploy) | DevOps & Backend Agents | Vault configurations, key-rotation strategies, and dotenv segregation guidelines. |
| **PH2-DEC-003** | **Deployment & Environment Strategy** | Deferred | Phase 2 (Late-Planning) | Phase 6 (Testing/Deploy) | DevOps Agent | Docker layout, local execution model vs production target (Vercel, AWS, etc.). |
| **PH2-DEC-004** | **Local/Dev Env Assumptions** | Deferred | Phase 2 (Early Planning) | Phase 2 (Scaffolding Code) | Architect Agent | Define node/npm version ranges, shell compatibility (Windows PowerShell/bash), monorepo tooling (Lerna, npm workspaces, pnpm). |
| **PH2-DEC-005** | **Bet History & Audit Boundary** | Deferred | Phase 5 | Phase 5 (Betting Module) | Product Research Agent | Data validation structures to ensure bet simulation logging matches auditing needs. |
| **PH2-DEC-006** | **Bankroll, Risk, & Responsible Use** | Deferred | Phase 5 | Phase 5 (Betting Module) | Product Research Agent | Formulas for checking daily bet limits, budget tracking, and responsible use rules. |
| **PH2-DEC-007** | **Chat Persistence & Privacy Caching** | Deferred | Phase 5 | Phase 5 (Betting Module) | AI/Data Agent | Caching LLM prompts, history retention limits, and customer-privacy boundaries. |
| **PH2-DEC-008** | **Local AI Invocation Scheduling** | Deferred | Phase 4 | Phase 4 (Local AI) | AI/Data Agent | Defining cron patterns vs match kickoff dynamic queues for prediction triggers. |

---

## 2. Governance Rules

1. **Gatekeepers**: No items on this backlog may be resolved directly in implementation code. They must be promoted to **Accepted** status in an ADR file first.
2. **Phase 2 Scaffolding Blocks**: The codebase scaffolding remains locked and cannot commit database dependencies or secret credentials until **PH2-DEC-001** and **PH2-DEC-002** are resolved as ADRs.
3. **Phase 4 & 5 Deferred Items**: Items **PH2-DEC-005** through **PH2-DEC-008** are officially deferred until the skeleton is fully verified.

---

## 3. Next Decisions Required Before Scaffolding Code

1. **Approval of ADR-0003 Product Boundary**: Accept Option B to unlock client-server route designs.
2. **Resolution of PH2-DEC-004 Monorepo Tooling**: Confirm if we use `npm workspaces`, `yarn`, or `pnpm` for directory package linking.
