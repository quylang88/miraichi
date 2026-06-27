# Phase 6 Repo-Wide TypeScript Migration Review

## Purpose
Record the owner-requested `phase:code-slice Phase 6 repo-wide JavaScript-to-TypeScript migration` result.

## Status
- **Status**: Completed - Verified

## Scope
This review covers tracked implementation source under `apps/`, `packages/`, and `scripts/`.

The slice does not add CI deployment, Cloudflare secrets, production promotion, real provider selection, auth, cloud sync, production schemas, betting formulas, prediction algorithms, or AI recommendation ranking.

## Changes
- Renamed tracked `.js` implementation and test files under `apps/`, `packages/`, and `scripts/` to `.ts`.
- Added `tsx` and `@types/node` as workspace dev dependencies.
- Allowed the `esbuild` build script in `pnpm-workspace.yaml` so `tsx` can run reliably.
- Updated root, app, and package scripts to execute TypeScript source through `tsx`.
- Updated the web dev server and static build to serve browser `.js` compatibility URLs from TypeScript source.
- Updated lifecycle and guardrail docs so tracked implementation source stays TypeScript-first after this migration.

## Gate Result

| Requirement | Result | Evidence |
| :--- | :---: | :--- |
| Owner explicitly requested repo-wide migration | PASS | Active request: "sửa guardrail và migration toàn bộ repo luôn". |
| Runtime strategy updated | PASS | `package.json` scripts now use `tsx`; web build/dev paths transpile TypeScript source for browser `.js` URLs. |
| Source inventory migrated | PASS | `git ls-files apps packages scripts | rg "\.js$"` and `rg --files -g "*.js" apps packages scripts` returned no source hits. |
| Browser compatibility preserved | PASS | `/service-worker.js` and `/apps/web/src/...js` paths remain verified by PWA and staging smoke checks. |
| Blanket `@ts-nocheck` avoided | PASS | No blanket `@ts-nocheck` was added; boundary `any` remains only where migration needed runtime compatibility. |
| Local verification passed | PASS | `pnpm run verify:local` passed lifecycle, unit tests, syntax lint, typecheck, and audit. |
| Integration verification passed | PASS | `pnpm run test:integration` passed Phase 3, Phase 4, endpoint, and PWA checks. |
| Static artifact build passed | PASS | `pnpm run build:web-static` exited with code 0. |
| Public staging smoke passed | PASS | `pnpm run smoke:staging -- https://e9b19946.miraichi-staging.pages.dev` passed all five checks. |

## Commands Verified

```powershell
pnpm exec tsx --version
pnpm run typecheck
pnpm run check
pnpm exec vitest run scripts/staging-smoke-check.test.ts scripts/github-actions-ci-workflow.test.ts apps/web/src/pwa/register-service-worker.test.ts
pnpm run verify:local
pnpm run build:web-static
pnpm run test:integration
pnpm run smoke:staging -- https://e9b19946.miraichi-staging.pages.dev
rg --files -g "*.js" apps packages scripts
git ls-files apps packages scripts | rg "\.js$"
```

## Known Risks
- This is not a fully strict typing pass. `noImplicitAny` is still disabled and several module boundaries intentionally use `Record<string, any>` or DOM/runtime `any` to preserve behavior during migration.
- The smoke check proves the existing public staging URL is healthy, but it does not prove the TypeScript-sourced artifact has been redeployed to Cloudflare Pages.
- The syntax check script name still says `check-js-syntax`; TypeScript correctness is enforced by `pnpm run typecheck`.

## Recommended Next Phase

Earliest safe next command:

```text
phase:staging Phase 6 hardened staging process
```

Reason: local, integration, build, and staging smoke checks passed, but the refreshed TypeScript-sourced static artifact still needs a Phase 6 staging deployment and fresh post-deploy smoke evidence.
