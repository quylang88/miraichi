# FotMob Daily Terminal Results And Current Revalidation Implementation Plan

## Approved scope

The owner approved fast best-effort terminal-result updates on 2026-08-31 under ADR-0049. Implement
owner-local daily terminal checks plus current-edition ETag revalidation. Historical hydration,
lazy match detail, ESPN activation, staging, production, push, and anti-bot workarounds are out of
scope.

Every code slice follows RED -> minimal GREEN -> focused verification -> local commit before the
next slice starts.

Completion: all eight slices were implemented and locally committed on 2026-08-31. The final
release gate passed 102 unit files / 575 tests, 9 season integration files / 52 tests, and 7 FotMob
terminal integration files / 34 tests. Historical hydration, lazy detail, staging, production, and
push remain outside this completed plan.

## TDD slices

### 1. Registry result-request contract

- Failing test: extend `packages/config/src/season-source-registry.test.ts` to require 50 enabled
  `daily-api` result bindings with pinned numeric league IDs and an owner-country-code URL
  placeholder rather than a per-competition request country.
- Implementation: update `packages/config/src/season-source-registry.ts` without changing fixture or
  historical season eligibility.
- Verify: focused registry test and TypeScript.

### 2. Bounded FotMob daily client

- Failing test: add `apps/worker/src/sources/fotmob/fotmob-daily-client.test.ts` for exact URL/query,
  ETag/304, timeout, 3 MB response cap, strict envelope, no retry, and 403/429 block signal.
- Implementation: add `apps/worker/src/sources/fotmob/fotmob-daily-client.ts`.
- Verify: focused client test and TypeScript.

### 3. Existing-match terminal adapter

- Failing test: add `apps/worker/src/sources/fotmob/fotmob-daily-adapter.test.ts` for exact registry
  filtering, private-link identity, FT score update, postponed/cancelled update, unknown-match
  rejection, invalid score, and total exclusion of scheduled/live rows.
- Implementation: add `apps/worker/src/sources/fotmob/fotmob-daily-adapter.ts` using provider-neutral
  canonical contracts.
- Verify: focused adapter and canonical merge tests plus TypeScript.

### 4. Durable terminal planner and ledger

- Failing tests: add `apps/worker/src/sources/fotmob/fotmob-result-ledger.test.ts` and
  `apps/worker/src/sources/fotmob/fotmob-terminal-plan.test.ts` for kickoff +105, two-minute retry,
  five-minute missing delay, provider-date coalescing, restart resume, 45-attempt/+240-minute
  exhaustion, atomic ledger writes, and lease exclusion.
- Implementation: add `fotmob-result-ledger.ts` and `fotmob-terminal-plan.ts` in the same directory.
- Verify: both focused suites and TypeScript.

### 5. Terminal publication job

- Failing test: add `apps/worker/src/jobs/fotmob-terminal-result-job.test.ts` for no-due zero
  requests, one request per due date, ETag/304, one merged publication, live/no-change last-good
  preservation, restart state, malformed response, and 403/429 circuit break.
- Implementation: add `apps/worker/src/jobs/fotmob-terminal-result-job.ts` and reuse canonical
  warehouse/serving publication boundaries.
- Verify: focused job/client/adapter/ledger suites and TypeScript.

### 6. Owner-local once/watch runtime

- Failing test: add `scripts/fotmob-terminal-results-runtime.test.ts` for explicit network consent,
  fixed owner timezone/country validation, bounded one-shot requests, 30-second non-overlapping watch
  ticks, active-root guard, sanitized status, and no SportScore `/api/v1` path.
- Implementation: add `scripts/fotmob-terminal-results-runtime.ts`; add
  `data:results:terminal:once`, `data:results:terminal:watch`, and focused integration commands to
  `package.json`.
- Verify: focused runtime suite, lifecycle, product boundary, and TypeScript.

### 7. Current-edition ETag revalidation

- Failing tests: extend `season-hydration-plan.test.ts`, `season-hydration-job.test.ts`, and
  `season-hydration-runtime.test.ts` for completed-current TTL, ETag/304 timestamp advancement,
  registry order, max-nine batch, current-only enforcement, and zero historical eligibility.
- Implementation: extend the existing season planner/ledger/job/runtime with explicit revalidation
  mode and add `data:revalidate:season:current`.
- Verify: `pnpm run season:integration` and TypeScript.

### 8. Large-boundary integration and owner-local runbook

- Failing test: add `tests/integration/fotmob-terminal-results.test.ts` proving global-date
  coalescing, terminal-only publication through `/api/v1/matches`, restart recovery, block handling,
  and current revalidation without historical requests.
- Implementation: wire the integration command and update `docs/data/sportscore-local-operations.md`,
  coverage evidence, and `PROJECT_PLAN.md`.
- Verify: focused integration, `pnpm run verify:release`, active serving validation, and clean Git
  status. Commit locally; do not push.
