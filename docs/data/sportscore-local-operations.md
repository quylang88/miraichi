# SportScore Local Operations

## Boundary

These commands inspect local state, verify the checked-in contract fixture, prepare an isolated root, or bootstrap a previously validated snapshot. They do not call SportScore and do not authorize staging or production.

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

Preparation writes an isolation marker and empty provider-neutral storage directories. It still sets `realNetworkAuthorized: false`; it does not perform a smoke request. A real-network runner may only be executed in a separately approved staging phase after the terms-scope blocker is resolved.

Optional authentication remains server-side only:

```text
SPORTSCORE_API_KEY=<local secret, optional>
```

Do not send the key in chat, commit it, place it in browser code, or print it in logs.

## 4. Bootstrap an empty active root

Only after the isolated root contains a validated non-empty SportScore warehouse and serving snapshot:

```powershell
pnpm run sportscore:active:bootstrap -- --from-data-root C:\miraichi-isolated\sportscore-smoke --to-data-root C:\CODE\miraichi\apps\api\data --confirm BOOTSTRAP_SPORTSCORE_ACTIVE_ROOT
```

The command validates the isolation marker, serving snapshot, warehouse reference, and SportScore provenance. It copies the immutable warehouse/serving versions plus an optional source ledger, then publishes the serving manifest last. It refuses to overwrite a target that already has a serving manifest.

This bootstrap is a state-changing promotion step. Do not run it from local integration evidence alone; require a separately validated isolated root and explicit owner intent.

## Local integration gates

```powershell
pnpm run sportscore:integration
pnpm run verify:local
pnpm run test:integration
pnpm run verify:staging
git diff --check
```

`verify:staging` currently verifies a staging-build candidate locally. It does not deploy and does not call SportScore. Deployment, real-provider smoke, owner feedback, and production remain separate gates.
