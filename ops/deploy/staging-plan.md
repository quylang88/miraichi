# Staging Deployment Plan

Validation target configurations for testing.

## Purpose
Establishes the parameters for automated deployment of PRs to a staging environment.

## Status
- **Status**: Active
- **Review Status**: Phase 5.11 Cloudflare Pages staging target selected; deployment pending Cloudflare project, token, and Pages URL.

## Scope
Maps sandbox URLs, mock databases, and staging test suites.

Phase 5.11 staging scope is web/PWA only. It validates the local-first Add Bet draft persistence boundary without introducing API routes, cloud sync, authentication, production database schemas, formulas, prediction logic, or AI recommendation behavior.

## Selected Staging Target

- **Provider**: Cloudflare Pages.
- **Project**: `miraichi-web-staging`.
- **Deployment mode**: Direct Upload with Wrangler.
- **Staging URL**: Pending first successful deployment; expected shape is `https://miraichi-web-staging.pages.dev`.
- **Build command**: `pnpm run build:web-static`.
- **Build artifact**: `apps/web/dist`.
- **Required local/CI secrets**:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN`

Do not commit actual Cloudflare credentials.

## Staging Rules
- Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` before any staging action.
- `pnpm run verify:release` must pass before staging deployment.
- If staging targets, credentials, or sandbox URLs are not configured, fail fast and report the missing target instead of pretending a deployment happened.
- For Phase 5.11, deploy only the web/PWA staging surface to Cloudflare Pages.
- Execute staging smoke checks before promoting to owner feedback.
- Prepare an owner review pack with changed scope, test evidence, staging URL, known risks, and rollback notes.

## Phase 5.11 Deployment Command

Run release verification first:

```powershell
pnpm run verify:release
```

Export the static web artifact:

```powershell
pnpm run build:web-static
```

Confirm Cloudflare authentication before attempting deployment:

```powershell
pnpm dlx wrangler whoami
```

Then deploy the static artifact after Cloudflare credentials and project exist:

```powershell
pnpm dlx wrangler pages deploy apps/web/dist --project-name miraichi-web-staging
```

If the static export path changes later, update this command before running staging.

## Phase 5.11 Smoke Checks

After deployment, verify:

- The staging URL loads over HTTPS.
- `manifest.webmanifest` is reachable.
- `service-worker.js` is reachable and registers without console errors.
- The production shell renders the five approved tabs: `today`, `matches`, `bets`, `bankroll`, `miraichi`.
- Add Bet remains a planned boundary action; no finalized bet history, formulas, recommendation ranking, or settlement behavior appears.
- Browser storage uses IndexedDB for draft persistence; `localStorage` is not used for betting history.
- Backup/import JSON helper behavior remains covered by local verification before deploy.

## References

- Cloudflare Pages Direct Upload docs: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages Wrangler deploy command docs: https://developers.cloudflare.com/workers/wrangler/commands/#deploy-2
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/

## TODO / Next Steps
- [x] Select Cloudflare Pages as Phase 5.11 staging target.
- [x] Add `apps/web` static export command.
- [ ] Create Cloudflare Pages project `miraichi-web-staging`.
- [ ] Configure Cloudflare deployment credentials outside the repository.
- [ ] Run Phase 5.11 staging deploy command.
- [ ] Record staging URL and smoke-check evidence.
