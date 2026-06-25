# Phase 5.2 ADR Draft Plan

This document establishes the plan and strategy for drafting Architectural Decision Records (ADRs) under Phase 5.2 of the Miraichi project.

## 1. Why Phase 5.2 Uses Wave A First
Staging the planning of business logic prevents developer/agent drift and ensures that the project owner maintains absolute control over calculations and schemas.
* **Wave A** focuses on establishing the core **data and presentational boundaries** (fields, grouping context, basic market types, client views, and local persistence targets).
* By getting agreement on the data envelope shapes and presentation layers first, we prevent building logic on incorrect schemas, reducing code churn and avoiding over-engineering.

## 2. Exclusions in Wave A
To satisfy the governance policies in `docs/governance/OWNER-DECISION-GATES.md`, Wave A strictly **excludes** all:
* **Profit/Loss (P/L) and Settlement Formulas**: Quarter-line stakes and math rules are deferred.
* **AI Recommendation Algorithms**: Probability models and suggestion filters are deferred.
* **Bankroll and Risk Limits**: Limits, daily thresholds, and Kelly Criterion calculations are deferred.
* **Production Database Configurations**: Cloud SQL drivers, ORMs, table migrations, and hosting configurations are deferred.

## 3. Wave A ADRs (Drafts Only)
We will create drafts for the following 6 ADRs:
1. **ADR-0023**: User-Entered Real Bet Record Boundary
2. **ADR-0024**: Match-Centric Betting History Grouping
3. **ADR-0025**: Market Catalog and Line Preset Registry
4. **ADR-0026**: Odds Format Strategy Boundary
5. **ADR-0031**: PWA Betting Journal UX Boundary
6. **ADR-0033**: Local-First Betting Data Persistence and Backup Boundary

In addition, **ADR-0034: TypeScript Adoption and Typed Domain Contracts Boundary** may be drafted as a technical adjunct to Phase 5.2. ADR-0034 is not a betting/business-logic ADR. It must not authorize TypeScript installation, dependency changes, `tsconfig` files, JavaScript migration, framework selection, database/ORM selection, formulas, prediction algorithms, or AI recommendation logic.

## 4. Deferred ADRs (Later Waves)
The remaining ADRs in Phase 5's candidates backlog are deferred to Wave B and later:
* **ADR-0027**: Stake Points and Profit/Loss Boundary (Wave B)
* **ADR-0028**: Bet Lifecycle and Settlement Boundary (Wave B)
* **ADR-0029**: Reporting Aggregation Boundary (Wave B)
* **ADR-0030**: AI Betting Recommendation Boundary (Wave C)
* **ADR-0032**: Bankroll and Risk Strategy Boundary (Wave C)

## 5. Draft Status & Implementation Block
* **Draft Status Only**: All ADRs created in this step will be explicitly marked as `Status: Draft`. Under no circumstances may their status be changed to `Accepted` or `Ready` by the agent.
* **Implementation Gate**: Coding, schema creation, database client additions, and mock calculations remain **strictly blocked** until the project owner reviews this draft pack, chooses/accepts the ADRs, and explicitly authorizes an implementation phase.
* **TypeScript Gate**: ADR-0034 may recommend TypeScript as a technical direction, but TypeScript tooling and migration remain blocked until a later implementation plan is approved.

## 6. Owner Acceptance Update

On 2026-06-24, the owner explicitly approved accepting Wave A foundation ADRs ADR-0023, ADR-0024, ADR-0025, ADR-0026, ADR-0031, ADR-0033, and technical ADR-0034 as architecture and planning boundaries.

This acceptance does not authorize implementation. Phase 5.3 Wave A Implementation Planning may begin, but code, dependencies, TypeScript tooling, UI/router files, storage adapters, formulas, algorithms, schemas, migrations, and integrations remain blocked until a later owner-approved implementation plan.
