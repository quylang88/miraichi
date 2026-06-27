# Phase 6 Staging Smoke-Check Script Review

## Purpose
Record the `phase:code-slice Phase 6 staging smoke-check script` result.

## Status
- **Status**: Completed - Verified

## Scope
This review covers the repeatable staging smoke-check script and root `smoke:staging` command.

This slice does not add CI deployment, Cloudflare secrets, production promotion, real provider selection, auth, cloud sync, production schemas, betting formulas, prediction algorithms, or AI recommendation ranking.

## Gate Result

| Requirement | Result | Evidence |
| :--- | :---: | :--- |
| Failing test observed before implementation | PASS | `pnpm exec vitest run scripts/staging-smoke-check.test.js` failed because `scripts/staging-smoke-check.js` did not exist; this was later migrated to `.ts` by the repo-wide migration. |
| Minimal implementation added | PASS | `scripts/staging-smoke-check.js` and `smoke:staging` package script were added, then migrated to `scripts/staging-smoke-check.ts` and `tsx`. |
| Regression test added for `pnpm run ... -- URL` parsing | PASS | Test failed first with `resolveCliBaseUrl is not a function`, then passed after implementation. |
| Focused unit test passed | PASS | `scripts/staging-smoke-check.test.ts`: 7 tests passed after migration. |
| Typecheck passed | PASS | `pnpm run typecheck` exited with code 0. |
| Public staging smoke passed | PASS | `pnpm run smoke:staging -- https://e9b19946.miraichi-staging.pages.dev` passed all five smoke checks. |
| Full local verification passed | PASS | `pnpm run verify:local` passed lifecycle, 19 test files / 70 tests, JS syntax check, typecheck, and audit. |
| Lifecycle and diff checks passed | PASS | `pnpm run verify:lifecycle` and `git diff --check` exited with code 0. |
| Forbidden scope stayed out of smoke code | PASS | `scripts/staging-smoke-check.ts` and `scripts/staging-smoke-check.test.ts` contain no deploy, secret, database, betting formula, prediction, or recommendation markers. |

## Commands Verified

```powershell
pnpm exec vitest run scripts/staging-smoke-check.test.ts
pnpm run typecheck
pnpm run smoke:staging -- https://e9b19946.miraichi-staging.pages.dev
pnpm run verify:lifecycle
pnpm run verify:local
git diff --check
```

Smoke output:

```text
PASS root shell https://e9b19946.miraichi-staging.pages.dev/ ok
PASS manifest https://e9b19946.miraichi-staging.pages.dev/manifest.webmanifest ok
PASS service worker https://e9b19946.miraichi-staging.pages.dev/service-worker.js ok
PASS shell entry https://e9b19946.miraichi-staging.pages.dev/apps/web/src/shell-entry.js ok
PASS ui css https://e9b19946.miraichi-staging.pages.dev/packages/ui/src/index.css ok
```

## JavaScript To TypeScript Migration Note

This review started from the original smoke-check slice. The owner later approved repo-wide JavaScript-to-TypeScript migration, so the smoke checker now lives at `scripts/staging-smoke-check.ts` and is executed by `tsx`.

## Recommended Next Phase

Earliest safe next command:

```text
phase:code-slice Phase 6 CI check workflow
```
