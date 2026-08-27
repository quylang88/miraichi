# SportScore Local Operations

## Boundary

The review, contract, status, preparation, and bootstrap commands do not call SportScore. `sportscore:local:sync-once` is the only real-network local command. It requires explicit confirmations, performs at most one anonymous competition/day request, and does not authorize staging or production.

Real `/api/v1/fixtures/` use remains blocked until SportScore's published terms unambiguously cover that endpoint or written permission is retained. A local pass is not staging evidence.

## 1. Review terms and the approved contract fixture

```powershell
pnpm run sportscore:source:review
pnpm run sportscore:contract:verify
```

The first command prints the official terms/OpenAPI URLs, the local review date, the approved SHA-256, `termsScope: blocked`, and `realNetworkAuthorized: false`. The second command reads only the checked-in JSON fixture and fails if its bytes or required endpoint paths drift.

The checked-in fixture is a reviewed Miraichi contract excerpt, not a silently downloaded copy and not proof that the upstream document is unchanged. Upstream review is manual. If the official contract changes, stop, review the impact, update the fixture and approval manifest in one explicit change, and rerun the local gates.

## 2. Inspect request/checkpoint and serving status

The active local root is used by default:

```powershell
pnpm run sportscore:status
```

To inspect an isolated root:

```powershell
pnpm run sportscore:status -- --data-root C:\miraichi-isolated\sportscore-smoke
```

The output contains only serving freshness/counts and checkpoint totals. It does not print API keys, provider match IDs, provider URLs, or raw payloads.

## 3. Prepare an isolated smoke root

Use a new empty directory that is not `apps/api/data`:

```powershell
pnpm run sportscore:smoke:prepare -- --data-root C:\miraichi-isolated\sportscore-smoke
```

Preparation writes an isolation marker and empty provider-neutral storage directories. It still sets `realNetworkAuthorized: false`; preparation alone never grants network authority. The separate one-shot command requires its own exact confirmation. Local one-shot evidence does not resolve the terms-scope mismatch or approve cloud staging.

Optional authentication remains server-side only:

```text
SPORTSCORE_API_KEY=<local secret, optional>
```

Do not send the key in chat, commit it, place it in browser code, or print it in logs.

## 4. Run one anonymous local request in the isolated root

Use one explicit competition, UTC date, and season. The command forces anonymous mode even if `SPORTSCORE_API_KEY` exists in the caller environment, disables transport retries, and caps the run at one request:

```powershell
pnpm run sportscore:local:sync-once -- --data-root C:\miraichi-isolated\sportscore-smoke --date 2026-08-27 --competition-id uefa-conference-league --season 2026-27 --confirm-network SPORTSCORE_ANONYMOUS_ONE_SHOT
```

The default mode is `smoke`. It refuses `apps/api/data`, an unprepared directory, an overlapping root, an unknown competition, an invalid date, or a missing confirmation. Repeating a completed competition/date against the same root consumes zero requests because the durable checkpoint returns `idle`.

Inspect the result:

```powershell
pnpm run sportscore:status -- --data-root C:\miraichi-isolated\sportscore-smoke
```

To test the isolated snapshot through the Miraichi API without editing `.env`, launch a dedicated process with `LOCAL_MATCH_SERVING_ROOT` pointing to the isolated `serving` directory.

## 5. Bootstrap an empty active root

Only after the isolated root contains a validated non-empty SportScore warehouse and serving snapshot:

```powershell
pnpm run sportscore:active:bootstrap -- --from-data-root C:\miraichi-isolated\sportscore-smoke --to-data-root C:\CODE\miraichi\apps\api\data --confirm BOOTSTRAP_SPORTSCORE_ACTIVE_ROOT
```

The command validates the isolation marker, serving snapshot, warehouse reference, and SportScore provenance. It copies the immutable warehouse/serving versions plus an optional source ledger, then publishes the serving manifest last. It refuses to overwrite a target that already has a serving manifest.

This bootstrap is a state-changing promotion step. Do not run it from local integration evidence alone; require a separately validated isolated root and explicit owner intent.

After bootstrap, subsequent one-competition/day local syncs may target only the configured active root and require a second active-root confirmation:

```powershell
pnpm run sportscore:local:sync-once -- --mode active --data-root C:\CODE\miraichi\apps\api\data --date 2026-08-28 --competition-id eng-premier-league --season 2026-27 --confirm-network SPORTSCORE_ANONYMOUS_ONE_SHOT --confirm-active-root SPORTSCORE_ACTIVE_LOCAL_SYNC
```

Active mode refuses an arbitrary directory and refuses an empty/unbootstrapped `apps/api/data`. It still performs at most one anonymous request with no immediate retry.

## Local integration gates

```powershell
pnpm run sportscore:integration
pnpm run verify:local
pnpm run test:integration
pnpm run verify:staging
git diff --check
```

`verify:staging` currently verifies a staging-build candidate locally. It does not deploy and does not call SportScore. Deployment, real-provider smoke, owner feedback, and production remain separate gates.
