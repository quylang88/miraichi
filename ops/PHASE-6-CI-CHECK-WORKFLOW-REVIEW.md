# Phase 6 CI Check Workflow Review

## Purpose
Record the `phase:code-slice Phase 6 CI full` result.

## Status
- **Status**: Completed - Verified

## Scope
This review covers the check-only GitHub Actions workflow under `.github/workflows/ci.yml` and its workflow guardrail test.

This slice does not add CI deployment, Cloudflare secrets, production promotion, real provider selection, auth, cloud sync, production schemas, betting formulas, prediction algorithms, or AI recommendation ranking.

## Gate Result

| Requirement | Result | Evidence |
| :--- | :---: | :--- |
| Failing test observed before workflow implementation | PASS | `pnpm exec vitest run scripts/github-actions-ci-workflow.test.js` failed with 3 expected failures because `.github/workflows/ci.yml` did not exist. |
| Minimal check-only workflow added | PASS | `.github/workflows/ci.yml` runs install, lifecycle verification, unit tests, syntax check, typecheck, and audit. |
| Workflow deploy/secrets guardrail test passed | PASS | `scripts/github-actions-ci-workflow.test.js`: 3 tests passed. |
| Focused Phase 6 tests passed | PASS | `pnpm exec vitest run scripts/staging-smoke-check.test.js scripts/github-actions-ci-workflow.test.js`: 2 files / 10 tests passed. |
| Full local verification passed | PASS | `pnpm run verify:local`: lifecycle, 20 test files / 73 tests, JS syntax check, typecheck, and audit passed. |
| Integration verification passed | PASS | `pnpm run test:integration` passed Phase 3, Phase 4, endpoint, and PWA checks. |
| Workflow has no forbidden deploy or secret markers | PASS | Targeted scan of `.github/workflows/ci.yml` found no Wrangler, Cloudflare secret, deploy, staging deploy, or production markers. |

## Commands Verified

```powershell
pnpm exec vitest run scripts/github-actions-ci-workflow.test.js
pnpm exec vitest run scripts/staging-smoke-check.test.js scripts/github-actions-ci-workflow.test.js
pnpm run verify:local
pnpm run test:integration
rg -n "wrangler|pages deploy|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|secrets\\.|deploy:staging|deploy:staging:local|production" .github/workflows/ci.yml
```

## Notes

The broad forbidden-marker scan still reports existing expected references in blocking docs, local-only staging deploy scripts, tests, and guardrail verifiers. That is acceptable. The new workflow file itself contains no deploy command and no secret reference.

The workflow has not run on GitHub yet because this branch has not been pushed. Local verification proves the file content and command contract, not hosted-runner execution.

## JavaScript To TypeScript Migration Note

The owner requested a separate JS-to-TS slice after CI. The implementation plan now includes a narrow migration slice for `apps/web/src/pwa/register-service-worker.js` and its test only.

Do not treat that migration as completed by this review.

## Recommended Next Phase

Earliest safe next command:

```text
phase:code-slice Phase 6 migrate PWA service-worker registration JS to TS
```
