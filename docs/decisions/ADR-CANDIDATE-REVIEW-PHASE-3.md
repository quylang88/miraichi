# Phase 3 ADR Candidate Review

* **Date**: June 23, 2026
* **Status**: Completed

---

## 1. Summary

This document reviews the Architectural Decision Record (ADR) candidates for Phase 3 (Data Ingestion Planning). The review ensures that these decisions maintain strict architectural guardrails, prevent premature coding selections, and enforce competition agnosticism.

---

## 2. Candidate Classification Table

| Ref | Candidate Title | Recommended Classification | Ready for Drafting | Ready for Acceptance After Draft | Needs Revision |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **ADR-0013** | Storage Responsibility and Phase 3 Persistence Boundary | `READY_FOR_DRAFT_AND_ACCEPTANCE` | Yes | Yes | No |
| **ADR-0014** | Data Provider Abstraction and Source Selection Criteria | `READY_WITH_MINOR_REVISIONS` | Yes | Yes | Minor Revisions Done |
| **ADR-0015** | Generic Football Data Contract | `NEEDS_REVISION_BEFORE_ACCEPTANCE` | Yes | No | Yes (TS deferred) |
| **ADR-0016** | Ingestion Quality, Freshness, and Traceability Boundary | `READY_FOR_DRAFT_AND_ACCEPTANCE` | Yes | Yes | No |

---

## 3. Per-ADR Explanation & Findings

### ADR-0013: Storage Responsibility and Phase 3 Persistence Boundary
* **Classification**: `READY_FOR_DRAFT_AND_ACCEPTANCE`
* **Findings**: The proposed direction aligns with Phase 3's planning-first directive. It uses volatile local mock data/transient repositories to test ingestion without installing database clients (such as PostgreSQL) or ORMs (such as Prisma). Final production storage databases and schemas remain deferred.

### ADR-0014: Data Provider Abstraction and Source Selection Criteria
* **Classification**: `READY_WITH_MINOR_REVISIONS`
* **Findings**: Acceptable. All specific sports data provider vendor names (e.g. Sportmonks, API-Football) have been replaced or qualified as hypothetical vendor examples (`Provider Alpha`, `Provider Beta`, `ProviderAlphaAdapter`) to avoid committing to a particular vendor. The dynamic provider adapter parser pattern remains the core abstraction.

### ADR-0015: Generic Football Data Contract
* **Classification**: `NEEDS_REVISION_BEFORE_ACCEPTANCE`
* **Findings**: The candidate originally recommended strict compile-time TypeScript interfaces. However, the current project scaffold utilizes JavaScript. Enforcing TypeScript immediately would violate codebase consistency and drift scope. The recommendation has been revised to define documentation-first markdown schemas and JavaScript mock contract objects in `packages/shared` first, deferring TypeScript compiler integration to a separate future ADR.

### ADR-0016: Ingestion Quality, Freshness, and Traceability Boundary
* **Classification**: `READY_FOR_DRAFT_AND_ACCEPTANCE`
* **Findings**: Acceptable. Ingestion validators filter out invalid odds and match scores at the parser adapter boundary and append audit metadata (`ingestedAt`, `sourceProviderId`). No production logging stacks or audit database engines are defined.

---

## 4. Recommended Next Actions

1. **ADRs Ready for Drafting & Acceptance**:
   * **ADR-0013** and **ADR-0016** may be drafted as official ADR files and promoted to **Accepted** status.
   * **ADR-0014** is ready for drafting and local acceptance following the qualified vendor revisions in the candidate backlog.
2. **ADRs Needing Revision**:
   * **ADR-0015** must be drafted with a clear statement deferring TypeScript compiler selection and adopting documentation/JavaScript mock contracts for Phase 3.

---

## 5. Strict Guardrail Confirmations

- **No Ingestion Integration**: **CONFIRMED**. No network routes, mock API adapters, or ingestion polling workers have been implemented.
- **No Database/ORM Configuration**: **CONFIRMED**. No DB packages (Prisma, SQLite client, Knex, pg) have been installed, and no schemas/migrations exist.
- **Competition Agnosticism**: **CONFIRMED**. All examples avoid specific tournaments (such as the World Cup) and use generic labels (`competition-alpha`, `season-alpha-2026`).
