# Phase 9 Provider-Neutral Serving Store And App API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old single-file `national-team-matches.json` app data path with a provider-neutral partitioned serving store for Miraichi local app API.

**Architecture:** Raw provider archives stay append-only evidence. Provider normalizers write canonical warehouse entities/provenance. A serving builder materializes API-optimized match partitions plus a manifest; API routes and cloud sync read the serving store only. AI training must read canonical warehouse and build separate leakage-safe training datasets, never serving partitions.

**Tech Stack:** TypeScript, Node filesystem JSON/JSONL, Vitest, existing `LocalMatch` app contracts and API repository interface.

---

## Scope Decisions

- The old `apps/api/data/local-match-snapshots/national-team-matches.json` path is removed from the active app architecture.
- The old `national-team-matches.seed.json` manual seed path is removed from the active app architecture.
- The old `scripts/update-national-team-data.ts` command is removed from the active app architecture.
- No legacy fallback from serving store to `national-team-matches.json`.
- `snapshotId` remains in the API contract as a version/status identifier, not as proof that the data source is a monolithic JSON file.
- Club expansion is represented in serving layout as `scope=national-team|club`, but Phase 9 app contract still only accepts national-team matches.
- Odds, xG, provider predictions, stake advice, ROI, CLV, Kelly logic, and betting recommendations remain outside the app API.
- AI training remains Phase 10. It reads canonical warehouse and produces separate training datasets, not serving-store API projections.
- Sportmonks raw capture enters the app path only through `pnpm run data:normalize:sportmonks:warehouse` followed by `pnpm run data:build:serving:matches`.

## Files

- Create `apps/api/src/repositories/serving-match-store.ts`: serving store manifest/partition contracts, builder, reader, canonical warehouse conversion, validation.
- Create `apps/api/src/repositories/serving-match-store.test.ts`: TDD coverage for manifest, partitions, upsert/dedupe, warehouse conversion, missing/invalid failures.
- Create `apps/api/src/repositories/serving-match-store-repository.ts`: `MatchSnapshotRepository` implementation backed only by serving store.
- Create `apps/api/src/repositories/serving-match-store-repository.test.ts`: API repository filtering, sorting, find-by-id, status, and missing store behavior.
- Create `scripts/build-serving-match-store.ts`: owner-run CLI to build serving partitions from `apps/api/data/warehouse/*.jsonl`.
- Create `scripts/build-serving-match-store.test.ts`: CLI/module smoke for warehouse-to-serving build.
- Create `apps/api/data/serving/README.md`: documents serving store as the only local app API data path.
- Modify `apps/api/src/routes/matches.ts`, `apps/api/src/routes/match-detail.ts`, `apps/api/src/routes/data-snapshot-status.ts`: default to `ServingMatchStoreRepository`, update error wording away from local snapshot file.
- Modify `apps/api/src/index.ts`: use serving store as local/cloud source before cloud fallback.
- Modify `apps/api/src/services/cloud-match-snapshot-sync.ts`, `scripts/sync-serving-match-store-to-cloud.ts`, `scripts/supabase-local-workflow.ts`: sync from serving store metadata, not the old local snapshot file.
- Modify web copy/tests to say serving store or local match feed, not local snapshot.
- Modify `package.json`: replace old data update/validate scripts with `data:build:serving:matches` and `data:validate:serving:matches`.
- Delete `apps/api/src/repositories/local-match-snapshot-repository.ts` and `.test.ts`.
- Delete `scripts/update-national-team-data.ts` and `.test.ts`.
- Delete `apps/api/data/local-match-snapshots/README.md`, `national-team-matches.seed.json`, and `national-team-matches.json`.

## Tasks

### Task 1: Serving Store Contracts And Builder

- [x] Write failing tests for `buildServingMatchStore`, asserting that it writes `manifest.json`, `scope=national-team/by-date/YYYY-MM-DD.json`, `scope=national-team/by-competition/<competitionId>/<season>.json`, and `indexes/match-id.json`.
- [x] Write failing tests proving duplicate match IDs are upserted, not appended twice.
- [x] Implement `buildServingMatchStore` with validation through `validateLocalMatch`.
- [x] Run `pnpm exec vitest run apps/api/src/repositories/serving-match-store.test.ts`.

### Task 2: Serving Store Reader And Repository

- [x] Write failing tests for `readServingMatchStoreSnapshot` missing manifest and invalid match handling.
- [x] Write failing tests for `ServingMatchStoreRepository` list/filter/find/status behavior.
- [x] Implement reader and repository with no fallback to `national-team-matches.json`.
- [x] Run `pnpm exec vitest run apps/api/src/repositories/serving-match-store.test.ts apps/api/src/repositories/serving-match-store-repository.test.ts`.

### Task 3: Warehouse-To-Serving CLI

- [x] Write failing tests for building serving matches from canonical warehouse JSONL files.
- [x] Implement canonical warehouse conversion using canonical matches, teams, competitions, and provider links.
- [x] Add `scripts/build-serving-match-store.ts`.
- [x] Replace package scripts: `data:build:serving:matches`, `data:validate:serving:matches`, and update `phase9:local-data-api-verify`.
- [x] Run `pnpm exec vitest run scripts/build-serving-match-store.test.ts`.

### Task 4: API, Cloud Sync, And UI Copy

- [x] Update routes and server composition to instantiate `ServingMatchStoreRepository`.
- [x] Update route tests to use `MatchSnapshotRepository` or serving-store wording.
- [x] Update cloud sync and Supabase local workflow to sync from serving store.
- [x] Update web shell copy/tests from local snapshot wording to serving/local match feed wording.
- [x] Run the focused API/web/service test set.

### Task 5: Delete Old Direction

- [x] Delete old local snapshot repository, update-national-team script, tracked local snapshot data directory, and references in package scripts.
- [x] Add `apps/api/data/serving/README.md` documenting the replacement path.
- [x] Update Phase 9 product/local docs that still present `national-team-matches.json` as the active path.
- [x] Run `rg "national-team-matches|local-match-snapshots|update-national-team-data|LOCAL_MATCH_SNAPSHOT_PATH" package.json apps scripts docs -n -g "!docs/superpowers/plans/2026-07-01-phase-9-api-football-removal-local-data-api.md" -g "!docs/superpowers/plans/2026-07-02-phase-9-sportmonks-trial-data-capture-sprint.md"` and confirm only historical/superseded plan references remain.

### Task 6: Verification

- [x] Run focused tests:
  `pnpm exec vitest run apps/api/src/repositories/serving-match-store.test.ts apps/api/src/repositories/serving-match-store-repository.test.ts apps/api/src/routes/matches.test.ts apps/api/src/routes/match-detail.test.ts apps/api/src/routes/data-snapshot-status.test.ts apps/api/src/services/cloud-match-snapshot-sync.test.ts scripts/build-serving-match-store.test.ts scripts/sync-serving-match-store-to-cloud.test.ts scripts/supabase-local-workflow.test.ts apps/web/src/services/match-feed-service.test.ts apps/web/src/production-shell.test.ts`
- [x] Run `pnpm run typecheck`.
- [x] Run `pnpm run verify:local`.
- [x] Run `git diff --check`.
