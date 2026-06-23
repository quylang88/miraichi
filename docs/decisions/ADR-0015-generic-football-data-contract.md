# ADR-0015: Generic Football Data Contract

* **Status**: Draft (TypeScript adoption is deferred)
* **Date**: 2026-06-23
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started

---

## 1. Context
Sports feeds represent football concepts (tournaments, matches, odds, teams) using varying payload formats. To maintain competition agnosticism, the core Miraichi codebase must define a standardized, generic domain model.

## 2. Options Considered
* **Option A**: Use loose ad-hoc JSON structures passed between components without schema validation.
* **Option B (Recommended)**: Define documentation-first contracts (markdown schemas) and JavaScript mock contract objects, deferring TypeScript interfaces.
* **Option C**: Deploy a centralized JSON Schema registry service with runtime validation at service boundaries.

## 3. Decision & Recommendation
Recommend **Option B**. Define documentation-first generic schemas and JavaScript mock contract objects in `packages/shared`. Data objects passed across boundaries (e.g. between `apps/worker` and `apps/api`) conform conceptually to these markdown schemas, using generic parameters (`competitionId`, `seasonId`). TypeScript compiler adoption is deferred to a separate future ADR.

## 4. Consequences
* All data remains aligned with a unified logical structure.
* Developers can reference clear markdown docs and JS mock objects to understand the payload shapes.
* No compile-time validation is performed yet, as the project currently runs on JavaScript.

## 5. Risks
* Developers might mismatch fields without compile-time safety checks.
* Defining a model that is too rigid may require refactoring when new, unexpected markets or stats types are introduced.

## 6. Open Questions
* How should player-level statistics (e.g., passes, yellow cards) or advanced team metrics (e.g., xG) be structured if prediction models require them later?
* How are odds changes tracked over time within this schema?

## 7. Explicit Exclusions
* This decision does NOT select a TypeScript compiler or TypeScript type enforcement within the codebase.
* This decision does NOT create DB-level tables, SQL schemas, or ORM model files.
