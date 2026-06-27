# Staging Deployment Plan

Validation target configurations for testing.

## Purpose
Establishes the parameters for automated deployment of PRs to a staging environment.

## Status
- **Status**: Active
- **Review Status**: Phase 6 planning active after Phase 5.12 Cloudflare Pages staging redeploy.

## Scope
Maps sandbox URLs, mock databases, and staging test suites.

Current staging scope is web/PWA only. It validates the local-first shell and draft persistence boundaries without introducing API routes, cloud sync, authentication, production database schemas, formulas, prediction logic, or AI recommendation behavior.

## Selected Staging Target

- **Provider**: Cloudflare Pages.
- **Project**: `miraichi-staging`.
- **Deployment mode**: Direct Upload with Wrangler.
- **Latest smoke-checked staging URL**: `https://e9b19946.miraichi-staging.pages.dev`.
- **Build command**: `pnpm run verify:staging` rebuilds the static artifact after release verification.
- **Build artifact**: `apps/web/dist`.
- **Required local/CI secrets**:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN`

Do not commit actual Cloudflare credentials.

## Staging Rules
- Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` before any staging action.
- `pnpm run verify:staging` must pass before staging deployment. It runs `verify:release` and then rebuilds `apps/web/dist`.
- If staging targets, credentials, or sandbox URLs are not configured, fail fast and report the missing target instead of pretending a deployment happened.
- For the current Phase 6 planning baseline, deploy only the web/PWA staging surface to Cloudflare Pages.
- Execute staging smoke checks before closing the intermediate phase.
- Prepare a phase closeout pack with changed scope, test evidence, staging URL, known risks, rollback notes, and the recommended next phase.
- Do not promote an intermediate phase to formal owner-feedback or production unless the owner explicitly requests that checkpoint.

## Current Deployment Command

Run staging verification first. This command also rebuilds the static web artifact:

```powershell
pnpm run verify:staging
```

Confirm Cloudflare authentication before attempting deployment:

```powershell
pnpm dlx wrangler whoami
```

Then deploy after Cloudflare credentials and project exist:

```powershell
pnpm run deploy:staging:local
```

Do not run `wrangler pages deploy apps/web/dist` directly during normal staging work; that can deploy a stale artifact if `apps/web/dist` was not rebuilt.

## Current Smoke Checks

After deployment, verify:

- The staging URL loads over HTTPS.
- `manifest.webmanifest` is reachable.
- `service-worker.js` is reachable and registers without console errors.
- The production shell renders the five approved tabs: `today`, `matches`, `bets`, `bankroll`, `miraichi`.
- Add Bet remains a planned boundary action; no finalized bet history, formulas, recommendation ranking, or settlement behavior appears.
- Browser storage uses IndexedDB for draft persistence; `localStorage` is not used for betting history.
- Backup/import JSON helper behavior remains covered by local verification before deploy.

## Phase 6 Smoke Command

Run the automated smoke check against the current Cloudflare Pages deployment URL:

```powershell
pnpm run smoke:staging -- https://e9b19946.miraichi-staging.pages.dev
```

Replace the URL with the deployment URL returned by the current staging deploy.

## References

- Cloudflare Pages Direct Upload docs: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages Wrangler deploy command docs: https://developers.cloudflare.com/workers/wrangler/commands/#deploy-2
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/

## TODO / Next Steps
- [x] Select Cloudflare Pages as Phase 5.11 staging target.
- [x] Add `apps/web` static export command.
- [x] Create Cloudflare Pages project `miraichi-staging`.
- [x] Configure Cloudflare deployment credentials outside the repository.
- [x] Run Phase 5.11 staging deploy command.
- [x] Record staging URL and smoke-check evidence.
- [x] Defer formal owner-feedback and production promotion until all planned release phases are complete.
- [x] Record Phase 5.12 staging redeploy evidence: `https://e9b19946.miraichi-staging.pages.dev`.
- [x] Plan repeatable staging smoke automation in Phase 6.
- [x] Implement repeatable staging smoke command with `pnpm run smoke:staging`.
