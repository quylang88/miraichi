# Staging Deployment Plan

Validation target configurations for testing.

## Purpose
Establishes the parameters for automated deployment of PRs to a staging environment.

## Status
- **Status**: Active
- **Review Status**: Phase 5.11 Railway staging target selected; deployment pending Railway project, service, token, and public domain.

## Scope
Maps sandbox URLs, mock databases, and staging test suites.

Phase 5.11 staging scope is web/PWA only. It validates the local-first Add Bet draft persistence boundary without introducing API routes, cloud sync, authentication, production database schemas, formulas, prediction logic, or AI recommendation behavior.

## Selected Staging Target

- **Provider**: Railway.
- **Project**: `miraichi-staging`.
- **Service**: `miraichi-web-staging`.
- **Deployment mode**: Git-connected Railway deployment or Railway CLI deployment.
- **Staging URL**: Pending first successful deployment; expected shape is a Railway public domain for `miraichi-web-staging`.
- **Runtime**: Node.js using Railway-provided `PORT`.
- **Build command**: `pnpm install --frozen-lockfile`.
- **Start command**: `pnpm --filter web run start`.
- **Required local/CI secrets**:
  - `RAILWAY_TOKEN` for CLI/CI deployment.

Do not commit actual Railway credentials.

## Staging Rules
- Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` before any staging action.
- `pnpm run verify:release` must pass before staging deployment.
- If staging targets, credentials, or sandbox URLs are not configured, fail fast and report the missing target instead of pretending a deployment happened.
- For Phase 5.11, deploy only the web/PWA staging surface to Railway.
- Execute staging smoke checks before promoting to owner feedback.
- Prepare an owner review pack with changed scope, test evidence, staging URL, known risks, and rollback notes.

## Phase 5.11 Deployment Command

Run release verification first:

```powershell
pnpm run verify:release
```

Then deploy the web service after Railway credentials, project, service, and public domain exist:

```powershell
pnpm dlx @railway/cli up --service miraichi-web-staging
```

Set the Railway service start command to:

```text
pnpm --filter web run start
```

If a static build/export pipeline is added later, revisit the target and command before running staging.

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

- Railway monorepo deployment docs: https://docs.railway.com/deployments/monorepo
- Railway start command docs: https://docs.railway.com/deployments/start-command
- Railway build and start command docs: https://docs.railway.com/builds/build-and-start-commands

## TODO / Next Steps
- [x] Select Railway as Phase 5.11 staging target.
- [ ] Create Railway project `miraichi-staging`.
- [ ] Create Railway service `miraichi-web-staging`.
- [ ] Configure Railway deployment token outside the repository.
- [ ] Run Phase 5.11 staging deploy command.
- [ ] Record staging URL and smoke-check evidence.
