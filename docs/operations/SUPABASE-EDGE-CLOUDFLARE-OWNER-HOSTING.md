# Supabase Edge + Cloudflare Worker owner hosting runbook

> **Status: local implementation and release closeout complete on 2026-09-07.** The next phase is
> Frankfurt staging, blocked until the owner explicitly authorizes push/deploy/remote migration and
> enters the required secrets/configuration directly into Supabase Edge Secrets, Supabase Vault,
> and Cloudflare.

This runbook replaces the Koyeb deployment path. It retains the Frankfurt Supabase staging project
and its verified match snapshot. It does not authorize a push, Tokyo project, production promotion,
paid service, remote database reset, or project deletion.

## Current retained state

- Supabase project: `Miraichi Staging`
- Project ref: `qpexxwmrnreooxftfucv`
- Region: Frankfurt
- Remote applied migrations: six versions through `20260902120000`; the seventh local migration
  `20260903120000_edge_hourly_live_refresh.sql` remains unapplied until owner-authorized staging.
- Verified cloud snapshot: 10,899 matches, 45 competitions, one snapshot
- Data API: disabled in hosted staging
- Local CA: `.secrets/supabase-staging-ca.crt` (gitignored; used only by owner-local DB tooling)

Do not delete or reset this project. Do not move the CA into source control.

## 0. Preconditions

From `C:\CODE\miraichi`, require a clean reviewed commit and run:

```powershell
git status --short --branch
git log -10 --oneline
pnpm install --frozen-lockfile
pnpm run verify:product-boundary
pnpm run verify:local
pnpm run test:integration
pnpm run verify:release
pnpm run verify:staging
pnpm run data:validate:serving:matches
pnpm run edge:function:build
pnpm run edge:function:graph:verify
pnpm run edge:runtime:smoke -- --scope all
pnpm run cloudflare:artifact:verify
```

Do not continue on any failure. Local success is only a deployment precondition, not staging
approval.

Recorded local closeout evidence on 2026-09-07:

- `verify:product-boundary`, `verify:local`, `test:integration`, `verify:release`, and the local-only
  `verify:staging` command all passed; unit verification covered 140 files and 703 tests.
- The actual Supabase Edge Runtime `--scope all` smoke passed parameterized queries, rollback,
  commit, cleanup, scrypt, random bytes, HMAC session, generic invalid login, hardened cookie,
  protected route, refresh isolation, and logout.
- The Cloudflare dry-run artifact passed with 63 files, 385,780 total bytes, and a 54,672-byte
  largest file. The exact `--env staging` dry-run with all public bindings also passed without a
  missing-environment warning; verification now requires the explicit `env.staging` declaration.
- `git diff --check` passed. No remote operation occurred.

## 1. Secret inventory

The owner already holds these values in a password manager:

- `MIRAICHI_OWNER_PASSWORD_HASH`
- `MIRAICHI_SESSION_SECRET`
- `MIRAICHI_REFRESH_TOKEN`

Implementation adds one independent random value:

- `MIRAICHI_GATEWAY_TOKEN` (at least 32 random bytes)

Do not paste any value into chat, commit it, print it, or store it in a normal Wrangler variable.
The same gateway value must be stored independently in:

- Supabase Edge Function secrets;
- Cloudflare Worker secrets;
- Supabase Vault for the cron call;
- the owner's password manager.

Cloudflare must never receive a database URL/password, owner password hash, session secret, or
refresh token. The browser must receive none of these secrets.

## 2. Local Edge compatibility gate

Create `.secrets/edge.local.env` from names in `.env.example`; use only disposable local values and
quote the generated `MIRAICHI_OWNER_PASSWORD_HASH`. Never copy that file into source control. The
Windows local ports are `15420-15429` because this host reserves the former `54320-54419` range.

Build first, then start the local database/gateway/runtime and serve the function:

```powershell
pnpm run edge:function:build
pnpm run edge:function:graph:verify
pnpm exec supabase start --exclude gotrue,imgproxy,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector
pnpm exec supabase migration up --local --include-all
pnpm run supabase:local:sync
pnpm exec supabase functions serve miraichi-api --env-file .secrets/edge.local.env
```

In a second terminal run:

```powershell
pnpm run edge:runtime:smoke -- --scope all
pnpm run supabase:local:verify
```

These commands prove:

- exact `scrypt-v1` verification and session crypto;
- parameterized `postgres` reads/writes through `SUPABASE_DB_URL`;
- successful commit and injected rollback;
- no filesystem import in the Edge dependency graph;
- gateway rejection before route/body/database/provider work.

Record only status, timings, and sanitized error codes. Stop if the exact Edge runtime fails. Do not
enable Data API, weaken scrypt, use `rejectUnauthorized: false`, or change drivers as an ad hoc fix.

## 3. Configure and deploy the Frankfurt Edge Function (owner staging action)

After implementation and verification:

1. Confirm the CLI is still linked to `qpexxwmrnreooxftfucv`.
2. Confirm remote migrations match local; inspect a dry run before applying any new migration.
3. Create gitignored `.secrets/edge.staging.env` with the exact runtime names below. It contains four
   secrets plus non-secret runtime configuration, so protect the whole file. `SUPABASE_DB_URL` is
   provided by Supabase and must not be included or copied to Cloudflare.
4. Deploy the single `miraichi-api` function from the reviewed commit.
5. Record the commit, function deployment ID, and sanitized deployment output.
6. Call the direct function URL without the gateway token and verify it fails before health/auth.
7. Call the health route with the gateway token and `x-region: eu-central-1`; verify
   `x-sb-edge-region` is Frankfurt and no secret is returned.

Expected provider commands after their configuration exists:

```powershell
pnpm exec supabase link --project-ref qpexxwmrnreooxftfucv
pnpm exec supabase migration list
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
pnpm exec supabase secrets set --env-file .secrets/edge.staging.env --project-ref qpexxwmrnreooxftfucv
pnpm exec supabase functions deploy miraichi-api --project-ref qpexxwmrnreooxftfucv
```

The staging environment file must define only the required server runtime values; never enable the
local smoke route in staging:

```dotenv
APP_ENV=staging
MIRAICHI_GATEWAY_TOKEN=<PASSWORD_MANAGER_VALUE>
MIRAICHI_OWNER_AUTH_MODE=password
MIRAICHI_OWNER_PASSWORD_HASH='<PASSWORD_MANAGER_VALUE>'
MIRAICHI_SESSION_SECRET=<PASSWORD_MANAGER_VALUE>
MIRAICHI_REFRESH_TOKEN=<PASSWORD_MANAGER_VALUE>
MIRAICHI_OWNER_PROFILE_ID=owner-primary
MIRAICHI_PUBLIC_ORIGIN=https://<EXACT_STAGING_WORKER>.workers.dev
SPORTSCORE_LIVE_MODE=widget
```

Do not add `MIRAICHI_EDGE_RUNTIME_SMOKE=enabled`. Review `supabase secrets list` by name only after
setting the file; never print values.

Do not run `supabase db reset --linked` or any remote reset.

## 4. Configure and deploy Cloudflare Worker Static Assets (owner staging action)

Use a dedicated staging Worker on the owner's existing Cloudflare account and its generated
`*.workers.dev` URL. Do not purchase or attach a custom domain.

Required non-secret staging configuration:

- `DEPLOYMENT_ENV=staging`;
- `MIRAICHI_EDGE_FUNCTION_URL` set to the exact Supabase Edge Function URL;
- `MIRAICHI_EDGE_REGION=eu-central-1`;
- `MIRAICHI_PUBLIC_ORIGIN` set to the exact Cloudflare public origin after the Worker
  name/subdomain is known.

Required Cloudflare secret:

- `MIRAICHI_GATEWAY_TOKEN` only.

The reviewed Wrangler configuration must point Static Assets at `apps/web/dist`, use SPA fallback,
and run Worker code first only for exact `/api` and `/api/*`. The proxy performs one exact upstream
subrequest and never follows redirects.

Set the two task-specific PowerShell variables to reviewed non-secret values. The dry-run and
version upload pass all four public bindings explicitly; the gateway token is entered only at the
interactive secret prompt:

```powershell
$MiraichiEdgeUrl = "https://qpexxwmrnreooxftfucv.supabase.co/functions/v1/miraichi-api"
$MiraichiWorkerOrigin = "https://<EXACT_STAGING_WORKER>.workers.dev"
pnpm run build:web-static
pnpm run cloudflare:artifact:verify
pnpm --filter @miraichi/cloudflare-gateway exec wrangler deploy --env staging --dry-run --var "DEPLOYMENT_ENV:staging" --var "MIRAICHI_EDGE_FUNCTION_URL:$MiraichiEdgeUrl" --var "MIRAICHI_PUBLIC_ORIGIN:$MiraichiWorkerOrigin" --var "MIRAICHI_EDGE_REGION:eu-central-1"
pnpm --filter @miraichi/cloudflare-gateway exec wrangler versions upload --env staging --var "DEPLOYMENT_ENV:staging" --var "MIRAICHI_EDGE_FUNCTION_URL:$MiraichiEdgeUrl" --var "MIRAICHI_PUBLIC_ORIGIN:$MiraichiWorkerOrigin" --var "MIRAICHI_EDGE_REGION:eu-central-1"
pnpm --filter @miraichi/cloudflare-gateway exec wrangler versions secret put MIRAICHI_GATEWAY_TOKEN --env staging
pnpm --filter @miraichi/cloudflare-gateway exec wrangler versions deploy <SECRET_BEARING_VERSION_ID>@100% --env staging
```

`wrangler versions upload` and `wrangler versions secret put` create versions without routing
traffic. Read both outputs, use the version ID returned by the secret command, and only then run the
explicit `versions deploy`. Do not substitute `wrangler secret put`, which deploys immediately.
Record the active Worker version ID.

## 5. Same-origin staging smoke

Use only the Cloudflare `*.workers.dev` origin for browser smoke:

1. Root and deep SPA route return the PWA; static assets load without API redirects.
2. `/api/v1/health` succeeds through Cloudflare and is `Cache-Control: no-store`.
3. A direct Supabase Edge URL without gateway token fails.
4. Owner login with a wrong password returns the generic failure and sets no cookie.
5. Correct login returns a distinct `__Host-miraichi_owner` cookie with `Secure`, `HttpOnly`,
   `SameSite=Strict`, `Path=/`, and no `Domain`.
6. Session bootstrap, matches, bankroll setup/read, bet draft-to-settlement, backup export/log, live
   read, one manual refresh, and logout work through the Cloudflare origin.
7. Logout expires the cookie; subsequent owner route returns 401.
8. Browser/network inspection shows no gateway, refresh, session-signing, password-hash, database,
   private provider locator, or internal region header.
9. Supabase logs show Frankfurt execution and no secret values. Cloudflare confirms one subrequest
   per API call and no Worker invocation for ordinary static asset hits.

Do not call SportScore `/api/v1`. Do not execute full-season hydration or historical hydration.

## 6. Vault-backed hourly cron

The tracked migration creates but does not call these owner-only functions:

- `miraichi_app.configure_edge_hourly_live_refresh()`;
- `miraichi_app.invoke_edge_hourly_live_refresh()`;
- `miraichi_app.unschedule_edge_hourly_live_refresh()`.

It resolves exactly these Vault names at execution time:

- `miraichi_edge_function_url`;
- `miraichi_edge_gateway_token`;
- `miraichi_live_refresh_token`.

Local migration and disposable scheduler verification is repeatable with:

```powershell
pnpm exec supabase db reset --local
pnpm exec supabase migration up --local --include-all
pnpm run live:hourly:local-sql-smoke
pnpm exec supabase db lint --local --schema miraichi_app --level warning --fail-on error
pnpm exec supabase db advisors --local --type security --fail-on error
```

The explicit `migration up` makes this gate robust on the current Windows/Supabase CLI combination,
where `db reset` has twice recreated the local database without applying migrations. It is local
only. Never substitute `--linked`.

Frankfurt Vault configuration and scheduling remain owner staging actions.

Only after the Edge function works:

1. Put the Edge Function URL, gateway token, and existing refresh-only token into Supabase Vault
   under the exact names defined by the tracked migration/operation contract.
2. Apply/enable the single named hourly job at minute 17.
3. Inspect `cron.job` to confirm one job, then trigger one controlled invocation.
4. Verify `cron.job_run_details` and the corresponding `pg_net` result without selecting decrypted
   Vault values into logs.
5. Confirm only `POST /api/v1/live/refresh?reason=hourly` ran, the durable lease/cooldown was honored,
   and execution region was Frankfurt.
6. Mark the GitHub Actions hourly workflow superseded only after this smoke passes.

After the three Vault values exist, the owner enables or disables exactly one job with:

```sql
select miraichi_app.configure_edge_hourly_live_refresh();
select miraichi_app.unschedule_edge_hourly_live_refresh();
```

The GitHub Actions hourly trigger remains the rollback scheduler until the Frankfurt cron smoke is
recorded. At that gate, remove only its `schedule` trigger and retain `workflow_dispatch`.

If the job loops, fails repeatedly, or targets the wrong route/region, unschedule the named job and
diagnose. Never delete canonical matches or the last-good live overlay as recovery.

## 7. Rollback drill

Before declaring staging complete:

- Record the last-good Git commit, Supabase function deployment ID, Cloudflare Worker version ID,
  cron job name, and snapshot ID.
- Prove Cloudflare can roll back to the prior version with `wrangler rollback <VERSION_ID>`.
- Prove the prior reviewed Edge function source can be redeployed from Git.
- Prove the named cron job can be unscheduled without deleting Vault or application data.
- Keep database migrations forward-only; use a reviewed compensating migration, never a linked reset.

Gateway secret rotations must be coordinated. A mismatched Cloudflare/Edge/Vault value intentionally
causes an outage; the recovery is restoring matching secret versions, not bypassing authentication.

## 8. Frankfurt staging to Tokyo production

Do nothing in this section until the owner explicitly approves production preparation.

1. Export and verify an owner backup from Frankfurt.
2. Create a separate Supabase project in Tokyo; do not move or delete Frankfurt.
3. Apply all migrations and verify their versions.
4. Sync the exact validated current match snapshot and verify row/competition/snapshot counts.
5. Configure independent Edge secrets and Vault values, then deploy the same reviewed function.
6. Run direct gateway and transaction smoke with `ap-northeast-1`.
7. Change the Cloudflare production target and region to Tokyo, deploy a recorded version, and run
   the complete authenticated/cron smoke.
8. Retain Frankfurt until Tokyo backup, owner flow, live refresh, rollback, and owner approval are
   all explicit. Deletion is a separate destructive action requiring explicit approval.

## Published limits to monitor

- Cloudflare Worker: 100,000 dynamic requests/day, 10 ms CPU/request, 50 subrequests/request,
  20,000 static files/version, 25 MiB/file. Static asset requests are free and unlimited.
- Supabase Edge: 500,000 invocations/month on Free, 2 seconds CPU/request, 256 MB memory, 150 seconds
  Free wall-clock duration.
- Supabase database: current 17 MB; 500 MB Free database quota/read-only threshold.

Sources:

- [Cloudflare Worker limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Supabase Edge limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase billing quotas](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase Postgres from Edge](https://supabase.com/docs/guides/functions/connect-to-postgres)
- [Supabase scheduling with Vault](https://supabase.com/docs/guides/functions/schedule-functions)
