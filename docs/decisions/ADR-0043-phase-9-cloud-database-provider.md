# ADR-0043: Phase 9 Cloud Database Provider for Four Non-AI Tabs

* **Status**: Accepted
* **Date**: 2026-07-02
* **Accepted Date**: 2026-07-02
* **Owner Approval Required**: Yes
* **Owner Approval**: Approved by owner chat response "ok" on 2026-07-02 after the explicit approval wording: `approve ADR-0043 Supabase hosted Postgres for Phase 9 cloud persistence`
* **Implementation Status**: Local implementation and integration verification completed on 2026-07-02; remote Supabase schema application, Supabase advisor checks, and staging verification remain pending
* **Depends On**:
  * [ADR-0033: Local-First Betting Data Persistence and Backup Boundary](file:///c:/CODE/miraichi/docs/decisions/ADR-0033-local-first-betting-data-persistence-and-backup-boundary.md)
  * [ADR-0042: Local Manual Data API and API-Football Free-Tier Removal](file:///c:/CODE/miraichi/docs/decisions/ADR-0042-local-data-api-and-api-football-removal.md)

---

## 1. Context

Phase 9 has removed API-Football from the active match-data path and added a local/manual match snapshot API. The next blocker is cloud persistence for the four non-AI tabs:

- `Today`
- `Matches`
- `Bets`
- `Bankroll`

The app needs durable cloud persistence for user-owned records and normalized match snapshot metadata, but it must not introduce betting advice, stake sizing, bankroll risk formulas, prediction runtime, live polling, odds ingestion, or AI training.

ADR-0033 approved a local-first persistence and backup boundary. ADR-0042 requires a separate cloud database provider ADR before implementing production cloud persistence.

## 2. Decision Summary

**Recommended provider: Supabase hosted Postgres.**

This ADR accepts Supabase Postgres as the Phase 9 cloud database provider, with a strict server-mediated owner-only architecture:

1. `apps/web` must not call Supabase directly in Phase 9.
2. `apps/web` must continue calling `apps/api`.
3. `apps/api` owns all persistence reads/writes.
4. Supabase credentials stay server-side only.
5. No `service_role` or secret key may be exposed to browser code.
6. Phase 9 remains owner-only; public multi-user auth is deferred unless a later ADR approves it.
7. All persisted data must remain exportable/importable to preserve the local-first backup boundary.

This is a provider selection and architecture boundary only. It does not create tables, schemas, migrations, database clients, auth flows, or production deployment changes by itself.

## 3. Source Facts Checked

### Supabase

- Supabase billing docs list Free plan quotas including 500 MB database size per project, 5 GB egress, 50,000 monthly active users, and Pro/Team quotas including 8 GB disk per project and 250 GB egress before overages: <https://supabase.com/docs/guides/platform/billing-on-supabase>
- Supabase database-size docs say Free projects enter read-only mode when database size exceeds 500 MB: <https://supabase.com/docs/guides/platform/database-size>
- Supabase compute docs say each project has a dedicated Postgres instance; Nano Free, Micro paid, and larger compute sizes are available: <https://supabase.com/docs/guides/platform/compute-and-disk>
- Supabase RLS docs describe row-level security as a Postgres primitive and defense-in-depth mechanism: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase API security docs say all tables and views exposed through the Data API should have RLS enabled, and granted tables without RLS can be accessed by roles with matching grants: <https://supabase.com/docs/guides/api/securing-your-api>
- Supabase changelog records a breaking/default behavior change: new tables are not exposed to the Data API automatically for new projects after May 30, 2026, and explicit grants become required for Data API access: <https://supabase.com/changelog?tags=breaking-change>
- Supabase production checklist warns Free projects may be paused for low activity and Free plan database backups are not available for download; Pro avoids inactivity pause and gives support access: <https://supabase.com/docs/guides/deployment/going-into-prod>

### Cloudflare D1

- Cloudflare D1 pricing bills by rows read, rows written, and storage; Free plan includes 5 million reads/day, 100,000 writes/day, and 5 GB storage, while paid includes 25 billion reads/month and 50 million writes/month before overage: <https://developers.cloudflare.com/d1/platform/pricing/>
- D1 does not bill for compute hours or egress, but Workers usage still matters when querying and serializing data: <https://developers.cloudflare.com/d1/platform/pricing/>
- D1 limits docs say each database can store up to 10 GB and that the 10 GB per-database limit cannot be increased: <https://developers.cloudflare.com/d1/platform/limits/>
- D1 individual databases are single-threaded and process one query at a time: <https://developers.cloudflare.com/d1/platform/limits/>

### Neon

- Neon docs list a Free plan with 100 CU-hours per project, 0.5 GB storage per project, and 5 GB public network transfer; Launch and Scale are usage-based paid plans: <https://neon.com/docs/introduction/plans>
- Neon pricing docs explain CU-hours, scale-to-zero, and usage-based compute billing: <https://neon.com/pricing>

## 4. Requirements

### 4.1 Functional Requirements

The cloud persistence provider must support:

- manual owner-entered bet records;
- draft and history workflows for `Bets`;
- owner-entered bankroll accounts and ledger entries;
- match snapshot metadata and normalized match records needed by `Today` and `Matches`;
- app settings needed for the four non-AI tabs;
- import/export or backup evidence;
- local development and staging verification.

### 4.2 Non-Functional Requirements

The provider must support:

- relational constraints for user records, match IDs, drafts, and ledger entries;
- migration history;
- integration tests;
- staged rollout;
- server-only secrets;
- clear cost limits for the owner-only app;
- future path to auth without forcing auth into the first cloud slice.

### 4.3 Security Requirements

Phase 9 cloud persistence must:

- keep all cloud database credentials out of `apps/web`;
- avoid direct browser-to-database writes in Phase 9;
- require `apps/api` validation before persistence;
- keep RLS enabled on any exposed Supabase table;
- use explicit grants if the Data API is used;
- prefer private/non-exposed schemas for server-only tables;
- never use user-editable metadata for authorization decisions;
- preserve export/import as a recovery path.

## 5. Options Considered

### Option A: Supabase Hosted Postgres

Supabase is a managed Postgres platform with Auth, generated APIs, RLS, Storage, Edge Functions, Realtime, dashboard tooling, and a local/CLI ecosystem.

Pros:

- Postgres fits relational app state better than document storage.
- RLS and Auth are available when the app moves beyond owner-only.
- Managed dashboard makes manual inspection practical.
- Free tier is enough for early owner-only development if data stays small.
- Pro path is clear when backups/no-pause/support become necessary.
- Works with server-mediated API architecture.

Cons:

- Free project database size is limited and can enter read-only mode above 500 MB.
- Free projects may be paused for inactivity.
- Data API exposure rules are changing in 2026, so migrations must include explicit grants if using Data API.
- Misusing `service_role` or exposing keys would be a severe security bug.
- Adds a non-Cloudflare dependency to the existing Cloudflare Pages deployment path.

### Option B: Cloudflare D1

D1 is Cloudflare's serverless SQLite database integrated with Workers and Pages.

Pros:

- Strong fit with the current Cloudflare Pages/staging direction.
- Low operational overhead.
- Free and paid usage model is simple for small workloads.
- No separate egress charge for D1 data access.
- Good for edge-local, owner-only app state if deployed fully on Workers.

Cons:

- SQLite/D1 is not Postgres; future relational/RLS/auth patterns would be custom.
- 10 GB per database limit cannot be increased.
- Each individual database is single-threaded.
- More custom work is needed for auth, access control, backup semantics, and local/staging parity.
- Less appropriate if later Phase 10 needs Postgres-compatible analytics or model metadata joins.

### Option C: Neon Serverless Postgres

Neon is serverless Postgres with branching, scale-to-zero, and usage-based billing.

Pros:

- Strong Postgres compatibility.
- Free plan has 100 CU-hours/project and scale-to-zero.
- Branching can be useful for preview/testing.
- Usage-based paid model can be cheap for intermittent owner-only workloads.

Cons:

- Auth and app backend features are less integrated than Supabase for this project's current needs.
- More glue code is required for auth, row-level access, backups, and admin workflows.
- Free storage is also 0.5 GB/project.
- Less convenient if the next implementation needs a single backend platform, not only a database.

### Option D: Firebase/Firestore

Firestore is a managed document database.

Pros:

- Good offline client story.
- Mature hosted backend.

Cons:

- Document model is a poor fit for relational bet records, match groups, ledger entries, source provenance, and later analytics.
- Would push logic into client/security rules sooner than the current API mediation boundary allows.
- Not recommended for Phase 9.

## 6. Decision

Adopt **Supabase hosted Postgres** as the Phase 9 cloud database provider.

Use **server-mediated persistence** through `apps/api` in the first implementation:

```text
apps/web -> apps/api -> Supabase Postgres
```

Do not use this Phase 9 slice to create direct browser Supabase clients, public multi-user auth, realtime subscriptions, edge functions, storage buckets, prediction tables, or formula-derived reporting views.

## 7. Approved Initial Data Boundary

The implementation plan may design persistence for these categories only:

1. `app_profile`
   - owner profile marker, app instance metadata, and settings needed by the four non-AI tabs.
2. `match_snapshot`
   - snapshot metadata, source provenance, freshness, and import status.
3. `match_record`
   - normalized scheduled/completed match records already accepted by the local data API.
4. `bet_record`
   - owner-entered bet records and draft/history state.
5. `bankroll_account`
   - owner-entered account/capital buckets.
6. `bankroll_ledger_entry`
   - owner-entered deposit, withdrawal, transfer, correction, and manual adjustment records.
7. `backup_export_log`
   - export/import metadata and integrity checks.

The implementation plan must still choose exact table names, column names, indexes, migrations, and tests. This ADR does not authorize concrete schema creation.

## 8. Explicit Non-Authorizations

This ADR does not approve:

- production schema files before a Phase 9 cloud persistence implementation plan;
- direct Supabase calls from `apps/web`;
- exposing Supabase secret/service keys to the browser;
- public signup/login flows;
- multi-user sharing;
- live match polling;
- odds provider integration;
- ROI, yield, CLV, Kelly, stake sizing, bankroll risk, or recommendation formulas;
- prediction runtime tables;
- `Miraichi AI` training or runtime;
- production promotion.

## 9. Required Implementation Plan Constraints

The next implementation plan must include TDD slices for:

1. Environment and dependency boundary
   - server-only Supabase/Postgres configuration;
   - `.env.example` placeholders without real secrets;
   - no browser-exposed secret variables.
2. Persistence adapter contract
   - interface first;
   - in-memory or file-backed test adapter;
   - Supabase adapter behind API boundary.
3. Migration planning
   - SQL migrations only after exact tests exist;
   - explicit RLS strategy;
   - explicit GRANT strategy if Data API is used;
   - no formulas or prediction fields.
4. `Bets` persistence
   - owner-entered records and drafts only.
5. `Bankroll` persistence
   - manual ledger/account records only.
6. `Today` and `Matches` persistence
   - match snapshot reads and stale/unavailable states.
7. Backup/export
   - export JSON and import validation preserved.
8. Verification
   - unit tests;
   - API integration tests;
   - staging smoke checks;
   - search audits for leaked keys and forbidden formulas.

## 10. Cost Boundary

Start with Supabase Free only for development and owner-only validation if data size stays comfortably under 500 MB.

Before treating staging as release-ready, explicitly decide whether to upgrade to Supabase Pro.

Recommended release posture:

- Development/local validation: Free is acceptable.
- Staging intended for serious owner testing: Free is acceptable only if inactivity pause and no downloadable backups are accepted.
- Production or long-running owner use: Pro is recommended because Free may pause for inactivity and lacks downloadable backups.

## 11. Consequences

Positive:

- Gives Phase 9 a concrete cloud persistence target.
- Keeps the app relational and migration-friendly.
- Preserves current API mediation boundary.
- Leaves a clear future path to Supabase Auth and RLS.
- Avoids creating a bespoke auth/access-control layer around D1.

Negative:

- Adds a second cloud provider beside Cloudflare.
- Requires careful secret handling.
- Requires careful RLS/grant planning if using Supabase APIs.
- Free plan is not enough for production-grade durability expectations.
- Owner must approve the provider before schema implementation can start.

## 12. Owner Decisions Recorded

| Question | Recommended Answer | Reason | Risk If Rejected |
| --- | --- | --- | --- |
| Should Phase 9 use Supabase hosted Postgres as the cloud database provider? | Yes. | It best matches relational app state, future auth/RLS, and server-mediated API architecture. | Choosing no provider keeps persistence blocked; choosing an ill-fitting provider creates rework. |
| Should the first cloud slice stay server-mediated through `apps/api`? | Yes. | It keeps secrets out of the browser and preserves ADR-0005 API mediation. | Direct browser DB access increases key/RLS mistakes before auth is ready. |
| Should public signup/login be included in this Phase 9 cloud slice? | No. | Owner-only persistence is enough to make the four non-AI tabs usable. | Auth expands scope and delays usable app completion. |
| Should Supabase Pro be required immediately? | No for development; decide before production/staging closeout. | Free is enough to validate owner-only flows if data is small. | Delaying the Pro decision too long risks weak backup/no-pause assumptions at release. |

Owner approved the recommended answers on 2026-07-02 for implementation planning. Supabase Pro remains a later staging/production decision, not an immediate requirement for local code-slice work.

## 13. Implementation Closeout

The Phase 9 cloud persistence code slice has now implemented the ADR-0043 server-mediated architecture locally:

- `apps/web` continues to call `apps/api`; it does not call Supabase directly.
- `apps/api` owns the persistence adapter boundary and the Supabase/Postgres adapter.
- The SQL migration is recorded at `supabase/migrations/20260702052851_phase9_cloud_persistence.sql`.
- Local verification passed on 2026-07-02 with `pnpm run verify:local`, `pnpm run phase9:non-ai-app-verify`, and `pnpm run test:integration`.

The remaining release blocker is remote/staging validation against a real Supabase project. Before staging closeout, the owner or deployment operator must:

1. create or choose the Supabase project;
2. apply `supabase/migrations/20260702052851_phase9_cloud_persistence.sql`;
3. run Supabase database advisors against the linked or URL-targeted database;
4. configure server-side staging secrets for `CLOUD_PERSISTENCE_MODE=supabase` and `SUPABASE_DATABASE_URL`;
5. run the Phase 9 staging gate and record smoke evidence.

## 14. Handoff

The next lifecycle command is:

`phase:staging Phase 9 Non-AI App Completion`

This handoff is blocked until the real Supabase project/database connection details are available and the migration/advisor checks above have been run. The implementation plan remains recorded at `docs/superpowers/plans/2026-07-02-phase-9-cloud-persistence-four-non-ai-tabs.md`.
