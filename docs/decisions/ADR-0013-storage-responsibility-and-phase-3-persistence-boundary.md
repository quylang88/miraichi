# ADR-0013: Storage Responsibility and Phase 3 Persistence Boundary

* **Status**: Accepted
* **Date**: 2026-06-23
* **Accepted Date**: 2026-06-23
* **Owner Approval**: Approved by project owner
* **Implementation Status**: Not started
* **Note**: This ADR guides Phase 3 mock ingestion planning and does not authorize production ingestion, database integration, provider integration, prediction logic, or betting logic.

---

## 1. Context
Miraichi needs to persist sports fixtures, odds feeds, prediction results, and bet history logs. At the start of Phase 3, we must define where and how data is persisted during local development and testing, without violating the scaffolding guardrails (e.g. no database clients, ORMs, or migrations in early scaffolding).

## 2. Options Considered
* **Option A (Recommended)**: Purely in-memory storage (e.g. JS Maps, arrays) reading from local mock JSON files.
* **Option B**: Embedded local lightweight store (e.g. SQLite, or flat-file db) with no external clients.
* **Option C**: High-performance production database client (e.g. PostgreSQL with Prisma/Drizzle ORM) configured immediately.

## 3. Decision & Recommendation
Recommend **Option A** for the Phase 3 persistence boundary. All ingestion components (e.g., `apps/worker`) will read from static local JSON mock files and persist records in transient in-memory stubs or local mock repositories. 

## 4. Consequences
* The codebase remains free of database clients and complex ORM setup during the planning gateway.
* Developer setup is simplified (no local Postgres/SQLite setup required to run tests).
* Data does not persist across restarts of the worker daemon or API gateway.

## 5. Risks
* Unable to test SQL queries, joins, indices, or database transaction rollbacks.
* Large datasets may cause high memory consumption in the mock server.

## 6. Open Questions
* What is the final production database type (SQL vs NoSQL)?
* Which ORM library or query-builder is best suited for performance and type safety when database integration starts?

## 7. Explicit Exclusions
* This decision does NOT select the final production database engine or hosting provider.
* This decision does NOT authorize the installation of ORM packages (such as Prisma, Drizzle, Sequelize) or DB clients.
* No migration folders, SQL script templates, or production database schemas will be created.
