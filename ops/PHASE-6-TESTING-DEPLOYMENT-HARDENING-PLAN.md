# Phase 6 Testing/Deployment Hardening Plan

## Purpose
Plan the non-production hardening work needed before any later final-release owner review or production promotion.

## Status
- **Status**: Active Planning
- **Review Status**: Owner approved implementation planning via `phase:implementation-plan Phase 6 CI/CD and Staging Smoke Automation`; implementation plan created.

## Scope
Phase 6 covers CI/CD workflow planning, repeatable staging deployment hardening, smoke-check automation planning, rollback notes, security/secrets audit planning, and monitoring plan drafts.

This phase does not approve production, does not create production infrastructure, does not add real data providers, does not create production database schemas, does not add auth or cloud sync, does not implement betting formulas, does not implement prediction algorithms, and does not add AI recommendation ranking.

## Current Baseline

| Area | Current state | Phase 6 implication |
| :--- | :--- | :--- |
| Local verification | `pnpm run verify:local` runs lifecycle, unit tests, syntax check, typecheck, and audit. | Keep this as the minimum PR-quality gate. |
| Integration verification | `pnpm run test:integration` runs Phase 3, Phase 4, endpoint, and PWA checks. | Keep this as the large-boundary integration gate. |
| Release verification | `pnpm run verify:release` chains local and integration checks. | Required before staging and any release candidate. |
| Staging verification | `pnpm run verify:staging` runs release verification and rebuilds `apps/web/dist`. | Required before any Cloudflare Pages staging deploy. |
| Staging deploy | `pnpm run deploy:staging:local` loads ignored `.env.local`, verifies staging, then deploys to Cloudflare Pages. | Manual staging is working; CI automation still needs owner-approved secret handling. |
| Latest staging evidence | `https://e9b19946.miraichi-staging.pages.dev` smoke-checked after Phase 5.12. | Use as the latest non-production reference URL until a newer staging deploy replaces it. |

## Workstreams

### 1. CI/CD Gate Design

Goal: define the GitHub Actions workflow before creating YAML.

Planned checks:

1. Install dependencies with `pnpm install --frozen-lockfile`.
2. Run `pnpm run verify:lifecycle`.
3. Run `pnpm run test:unit`.
4. Run `pnpm run lint`.
5. Run `pnpm run typecheck`.
6. Run `pnpm run audit`.
7. Run `pnpm run test:integration` only for large-boundary, staging, or release branches.
8. Run `pnpm run verify:staging` only before staging deployment.

Owner decision needed: whether CI should deploy staging automatically from a protected branch or keep Cloudflare deploy manual for now.

Recommended answer: keep deployment manual in Phase 6.1, then implement CI checks first. Automating deployment before secret policy is accepted is a bad trade.

### 2. Staging Deployment Hardening

Goal: turn the successful manual Cloudflare Pages staging flow into a repeatable, documented process.

Planned boundaries:

1. Keep Cloudflare credentials outside the repository.
2. Keep `.env.local` ignored by git.
3. Use `pnpm run deploy:staging:local` for owner-run local staging deploys.
4. Do not call `wrangler pages deploy` directly unless `pnpm run verify:staging` has just passed.
5. Record every staging URL and smoke evidence in a phase review document.

Owner decision needed: whether the long-term staging URL should use the Cloudflare project domain or only immutable deployment URLs.

Recommended answer: record immutable deployment URLs for evidence and optionally use the project domain for owner browsing. Immutable URLs are better evidence.

### 3. Smoke-Check Automation

Goal: replace ad hoc PowerShell smoke checks with a checked-in script after owner approval.

Planned smoke targets:

1. `/` returns HTTP 200 and contains `Miraichi`, `shell-entry`, and `app-root`.
2. `/manifest.webmanifest` returns HTTP 200 and has `name: "Miraichi"`.
3. `/service-worker.js` returns HTTP 200 and contains the current cache marker.
4. `/apps/web/src/shell-entry.js` returns HTTP 200 and contains `renderAppShell`.
5. `/packages/ui/src/index.css` returns HTTP 200 and contains `main-scroll`.

Owner decision needed: whether to create this as a Node script under `scripts/` or keep it as manual release-check instructions.

Recommended answer: implement a Node script in a later `phase:implementation-plan` because Node is already used for repo verification scripts.

### 4. Security And Secrets Audit

Goal: define what must be checked before any broader staging automation.

Planned checks:

1. Confirm `.env.local`, `.env`, `*.env`, logs, and build outputs stay ignored.
2. Confirm no Cloudflare token, API key, provider key, or auth secret appears in tracked files.
3. Confirm deployment scripts fail fast when required secrets are missing.
4. Confirm future CI secrets use the minimum Cloudflare token scope required for Pages deployment.
5. Confirm production secrets and production target selection remain blocked.

Owner decision needed: whether to approve GitHub Actions repository secrets for staging deployment during Phase 6.

Recommended answer: not yet. First approve CI checks without deploy, then decide staging deploy automation after the smoke script exists.

### 5. Rollback And Release Evidence

Goal: document how to recover from a bad staging deploy before any production work exists.

Planned rollback notes:

1. Keep the previous staging deployment URL in the phase review.
2. Use Cloudflare Pages deployment history for rollback if a new staging deploy breaks.
3. Re-run `pnpm run verify:staging` before redeploying a rollback artifact.
4. Do not treat rollback as production incident response yet because production remains blocked.

Owner decision needed: whether rollback should be manual only in Phase 6.

Recommended answer: yes. Manual rollback is enough while the app only has static web/PWA staging.

### 6. Monitoring Drafts

Goal: narrow monitoring to what exists now and avoid fantasy backend monitoring.

Planned monitoring scope:

1. Static web/PWA availability smoke checks.
2. Browser console error capture during staging QA.
3. Service worker cache marker verification.
4. Future API, worker, local-ai, database, and model metrics remain draft until those services are actually staged.

Owner decision needed: whether to choose a paid monitoring provider in Phase 6.

Recommended answer: no. Use scripted smoke checks and manual QA first; paid monitoring is premature without production traffic.

## Proposed Phase 6 Sequence

| Step | Lifecycle command | Output |
| :--- | :--- | :--- |
| 6.1 | `phase:plan Phase 6 Testing/Deployment Hardening` | This planning package and updated ops docs. |
| 6.2 | `phase:implementation-plan Phase 6 CI/CD and Staging Smoke Automation` | `ops/PHASE-6-CI-CD-STAGING-SMOKE-AUTOMATION-IMPLEMENTATION-PLAN.md`. |
| 6.3 | `phase:code-slice Phase 6 smoke-check script` | Completed by `ops/PHASE-6-STAGING-SMOKE-CHECK-SCRIPT-REVIEW.md`. |
| 6.4 | `phase:code-slice Phase 6 CI check workflow` | Completed by `ops/PHASE-6-CI-CHECK-WORKFLOW-REVIEW.md`. |
| 6.5 | `phase:code-slice Phase 6 migrate PWA service-worker registration JS to TS` | Narrow owner-requested migration slice added to the implementation plan. |
| 6.6 | `phase:integration-test Phase 6 verification hardening` | `pnpm run verify:local` and relevant integration checks pass after workflow/script/migration changes. |
| 6.7 | `phase:staging Phase 6 hardened staging process` | Staging deploy and automated/manual smoke evidence refreshed. |

## Exit Gate For This Planning Phase

This `phase:plan` can close only when:

1. The owner approves, rejects, or revises the Phase 6 workstreams.
2. CI deploy automation policy is explicit.
3. Smoke-check automation target is explicit.
4. Secret handling policy is explicit.
5. The next lifecycle command is chosen.

Recommended next command after the CI check workflow slice:

```text
phase:code-slice Phase 6 migrate PWA service-worker registration JS to TS
```

Do not start `phase:code-slice` until the implementation plan lists exact files, failing tests, implementation steps, and verification commands.
