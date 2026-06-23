# Phase 3 Candidate ADRs

This document compiles the candidate Architectural Decision Records (ADRs) for Phase 3 (Data Ingestion Planning). These candidates must be reviewed, finalized, and approved before implementing production data integrations.

---

## ADR-0013: Storage Responsibility and Phase 3 Persistence Boundary

* **Status**: Candidate
* **Date**: 2026-06-23

### Problem
Miraichi requires a plan for persisting ingested fixtures, odds, predictions, and bet slips. However, introducing a production database or ORM library at the start of Phase 3 violates the scaffolding guardrails and risks premature technology lock-in.

### Options
* **Option A**: Purely in-memory storage (e.g., volatile JS Maps/arrays) combined with reading local mock JSON files.
* **Option B**: Embedded local lightweight store (e.g. SQLite in-memory, or local file database) with no external clients.
* **Option C**: High-performance database client (e.g., PostgreSQL with Prisma/Drizzle ORM) configured immediately.

### Recommended Direction
**Option A**. For Phase 3 planning and skeleton, ingestion processes must read from static mock JSON files and store processed records in transient memory or mock repositories. 

### Risks
* Data is lost when the dev server or worker daemon restarts.
* Cannot test complex SQL queries or database-level integrity checks.

### Open Questions
* Which production database engine (PostgreSQL, MongoDB, or pure JSON Document Store) best serves historical stats query latency?
* Do we need an ORM, or are raw SQL queries/query builders (e.g., Knex) preferred for performance?

### What It Must Not Decide Yet
* The final production database technology.
* The specific ORM library or query-builder package.
* The production migration flow, schema SQL scripts, or hosting provider.

---

## ADR-0014: Data Provider Abstraction and Source Selection Criteria

* **Status**: Candidate
* **Date**: 2026-06-23

### Problem
Miraichi must ingest match fixtures and odds feeds from external sports providers. Direct coupling to a specific provider's API structure (e.g., Sportmonks, API-Football) makes it difficult to change vendors or support multiple data sources.

### Options
* **Option A**: Implement direct provider-specific API route integration within the worker daemon.
* **Option B**: Introduce a provider parser adapter interface that isolates external API schemas from core logic.
* **Option C**: Set up a decoupled caching proxy service to fetch, normalize, and serve the feeds.

### Recommended Direction
**Option B**. Define a strict `SportsDataProvider` parser adapter interface in `packages/shared` or `apps/worker`. Individual parsers map incoming feed payloads (e.g., `SportmonksAdapter`, `MockProviderAdapter`) into the internal generic model.

### Risks
* Over-engineering the abstraction layer if only one vendor is ever used.
* Variations in vendor features (e.g., one vendor lacks real-time odds update frequency) might leak through the interface.

### Open Questions
* Which sports API provider meets our requirements for cost, reliability, historical odds, and data granularity?
* Should we purchase a developer plan or build fallback scraper workflows?

### What It Must Not Decide Yet
* The final production sports data API vendor.
* The production API endpoints, request auth keys, or billing limits.

---

## ADR-0015: Generic Football Data Contract

* **Status**: Candidate
* **Date**: 2026-06-23

### Problem
External sports feeds represent concepts (tournaments, matches, odds) differently. To maintain competition agnosticism, the core Miraichi codebase must define a standardized, generic domain model.

### Options
* **Option A**: Use loose ad-hoc JSON structures passed between components without schema validation.
* **Option B**: Define strict, generic TypeScript interface contracts in `packages/shared` and compile-time types.
* **Option C**: Deploy a centralized JSON Schema registry service with runtime validation at service boundaries.

### Recommended Direction
**Option B**. Maintain centralized, generic types in `packages/shared`. Data objects passed across boundaries (e.g. between `apps/worker` and `apps/api`) conform strictly to these types, using generic parameters (`competitionId`, `seasonId`).

### Risks
* Defining a model that is too rigid may require refactoring when new, unexpected markets or stats types are introduced.

### Open Questions
* How should player-level statistics (e.g., passes, yellow cards) or advanced team metrics (e.g., xG) be structured if prediction models require them later?
* How are odds changes tracked over time within this schema?

### What It Must Not Decide Yet
* DB-level tables, columns, indexes, or specific SQL schema dialects.

---

## ADR-0016: Ingestion Quality, Freshness, and Traceability Boundary

* **Status**: Candidate
* **Date**: 2026-06-23

### Problem
Corrupted or stale odds feeds can lead to bad prediction outputs, which compromises system integrity. We must validate ingested feeds and audit the data state that triggered any given prediction.

### Options
* **Option A**: Process all incoming feed records as-is and delegate validations to the prediction engine.
* **Option B**: Enforce validation checks at the ingestion parser boundary and stamp metadata (timestamp, provider source) onto all normalized objects.
* **Option C**: Set up a secondary offline data validation and reconciliation process.

### Recommended Direction
**Option B**. The ingestion parser filters out invalid records (e.g., negative scores, zero odds, matches outside league dates) before normalization. Stamped metadata fields (`ingestedAt`, `sourceProviderId`) are appended for audit tracking.

### Risks
* Excessively strict validation thresholds might reject valid market outliers (e.g., very high underdog odds).

### Open Questions
* What is the threshold for deciding a fixture or odds line is "stale" and should be ignored?
* How do we handle partial feed failures (e.g., fixture metadata is correct, but odds feed fails)?

### What It Must Not Decide Yet
* Production logging stacks, exception trackers (e.g. Sentry), or audit storage systems.
