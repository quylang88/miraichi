# FotMob Unofficial Season Source Implementation Plan

## Approved scope

Owner approved the risk boundary in ADR-0049 on 2026-08-31. Implement local current-season
hydration first. ESPN remains disabled. No SportScore `/api/v1` call, no active-data deletion, no
push, staging, or production action is in scope.

## TDD slices

### 1. Registry and planner

- Failing tests: `packages/config/src/season-source-registry.test.ts` and
  `apps/worker/src/sources/hydration/season-hydration-plan.test.ts` require 50 pinned FotMob
  mappings, source capabilities, provider season labels, J1 cross-year handling, strict selected
  season targets, registry order, current barrier, and newly-added-current priority.
- Implementation: `packages/config/src/season-source-registry.ts` and
  `apps/worker/src/sources/hydration/season-hydration-plan.ts`.
- Verify: run both focused test files and TypeScript.

### 2. FotMob client

- Failing test: `apps/worker/src/sources/fotmob/fotmob-season-client.test.ts` covers exact allowlisted
  origin/path, parameters, ETag/304, timeout, response-size bound, invalid envelope, and 403/429
  run-block signal.
- Implementation: `apps/worker/src/sources/fotmob/fotmob-season-client.ts`.
- Verify: focused client suite.

### 3. Terminal-only adapter

- Failing test: `apps/worker/src/sources/fotmob/fotmob-season-adapter.test.ts` covers selected-season
  mismatch, stable IDs/links, scheduled and FT rows, live redaction, invalid scores, nullable venue,
  and collision rejection.
- Implementation: `apps/worker/src/sources/fotmob/fotmob-season-adapter.ts` plus the provider ID
  contract in `packages/shared/src/contracts/provider-ingestion-contracts.ts`.
- Verify: focused adapter/shared suites and TypeScript.

### 4. Hydration job and guarded runtime

- Failing tests: extend `apps/worker/src/jobs/season-hydration-job.test.ts` and
  `scripts/season-hydration-runtime.test.ts` for FotMob ETag/raw evidence, one merged publication,
  selected-season defer, 403/429 circuit break, current-only request cap, and preservation of an
  existing serving snapshot.
- Implementation: extend `apps/worker/src/jobs/season-hydration-job.ts` and
  `scripts/season-hydration-runtime.ts` through provider-specific boundary interfaces.
- Verify: `pnpm run season:integration`, `pnpm run verify:release`.

### 5. Owner-local current batch

- Preconditions: clean focused/release gates; active-root guard succeeds; no empty overwrite.
- Run current only with explicit network confirmation and bounded request count.
- Verify serving status, checkpoint count, provider raw evidence, and active match count before and
  after. Commit locally only; do not push.

Daily terminal results and lazy FT detail remain separate follow-up code slices. Mixing them into
season hydration would recreate the rejected request architecture.

