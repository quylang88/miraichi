# Phase 2: App Skeleton and Scaffold Planning

This document coordinates the scope, boundaries, and rules for constructing the application skeletons and shared packages during Phase 2.

## Overview

The primary objective of Phase 2 is to deploy a running monorepo skeleton that connects all apps and packages using placeholder boundaries. This sets up developer environments and verification routines before any feature development begins.

## Phase 2 Goals

1. **Monorepo Directory Setup**: Verify workspace package linking so packages under `packages/` can be imported by apps under `apps/` with proper TS/JS typing.
2. **Connectivity Validation**: Establish baseline HTTP, RPC, or messaging connections between:
   - `apps/web` (Frontend client)
   - `apps/api` (Mediation gateway)
   - `apps/local-ai` (Statistics/prediction server)
   - `apps/worker` (Data ingestion agent)
3. **Mock Boundaries**: Deploy end-to-end mock controllers returning stubbed JSON payloads without any live databases or data providers.
4. **Environment Scaffolding**: Setup local development scripts (`npm run dev` or equivalent) to run the full stack concurrently in development.

## Guardrails and Strict Constraints

To prevent developer and agent drift, the following restrictions are strictly enforced throughout Phase 2:
* **No Business Logic**: No mathematical model scoring, betting payout calculations, or bankroll limit checks may be coded.
* **No Production Database Schemas**: No database connections (e.g. Postgres, SQLite) or ORM models should be initialized for persistence. All storage boundaries must use memory array stubs.
* **No External Sports Data Providers**: No live API integrations (e.g., API-Football, odds providers) may be connected.
* **No Tournament Hardcoding**: All data shapes and configuration registers must be competition-agnostic. No references to specific events (e.g., "World Cup") may be hardcoded.

## Document Directory

Phase 2 scaffolding is governed by the following specifications:
* [app-skeleton-scope.md](file:///c:/CODE/miraichi/docs/scaffolding/app-skeleton-scope.md) — Structural files and boundaries for all apps.
* [package-skeleton-scope.md](file:///c:/CODE/miraichi/docs/scaffolding/package-skeleton-scope.md) — Boundaries and linkage for packages.
* [mock-boundary-contracts.md](file:///c:/CODE/miraichi/docs/scaffolding/mock-boundary-contracts.md) — Data schemas and contract responses for stubs.
* [no-business-logic-rules.md](file:///c:/CODE/miraichi/docs/scaffolding/no-business-logic-rules.md) — Detailed rules preventing premature implementation and coupling.
* [phase-2-review-checklist.md](file:///c:/CODE/miraichi/docs/scaffolding/phase-2-review-checklist.md) — Sanity checks before code is committed.
* [phase-2-exit-criteria.md](file:///c:/CODE/miraichi/docs/scaffolding/phase-2-exit-criteria.md) — Verification tests required to graduate Phase 2.
