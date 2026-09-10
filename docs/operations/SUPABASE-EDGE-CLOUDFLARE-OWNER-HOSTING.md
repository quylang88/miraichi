# Supabase Edge + Cloudflare Worker owner hosting runbook

> **Status: match-detail candidate passed; awaiting owner feedback.**
> User-triggered match detail, hosted browser E2E and rollback/restore passed on 2026-09-10.
> `pnpm run verify:staging:hosted` passed after restoration at `2026-09-10T06:11:26.413Z`.
> Local verification alone cannot close staging. Tokyo/production remains unapproved.

This runbook replaces the Koyeb deployment path. It retains the Frankfurt Supabase staging project
and its verified match snapshot. It does not authorize a push, Tokyo project, production promotion,
paid service, remote database reset, or project deletion.

## 2026-09-10 user-triggered match detail

The current scope is ADR-0053 and
`docs/superpowers/plans/2026-09-09-user-triggered-match-detail.md`. Information reads the cached
selected match with GET, then sends one explicit POST to `/api/v1/matches/detail/refresh?id=...`.
Opening a card starts on Bets without a detail request. Retry is manual; detail has no scheduler,
prefetch, pending retry timer, polling or automatic focus request. Existing current/terminal/LIVE
jobs retain their separate approved cadence.

Two forward-only migrations, `20260909160000` and `20260909170000`, add private detail cache/control
and the common provider circuit. GET never invokes the provider. POST uses owner/origin checks,
a per-match 60-second floor, fenced leases, one selected-provider call, ETag/304 and last-good
retention. Provider 403/429 blocks subsequent detail and scheduled requests through a shared
persisted circuit. There is no schema rollback or owner-data deletion during a runtime rollback.

FotMob detail requires a verified current-season binding and retained reference. SportScore
fallback requires an already observed exact widget slug; there is no discovery call or fallback
after a provider failure. Identity conflicts remain unavailable. Rich facts include events,
confirmed lineups/coaches, venue/referee/attendance, period/team/player statistics and shot
coordinates. Unknown values stay absent/null. Ratings, expected goals and predictions are excluded;
physical metrics whose units are unverified are not displayed.

The committed `tests/e2e/staging-match-detail.ts` runs within the authenticated owner suite. It
checks real completed/upcoming data, exact selected GET/POST counts, cooldown and rendering, then
explicit browser fixtures for errors, late responses and legacy 202 behavior. It inherits network
redaction and finally logout/cleanup. `scripts/match-detail-browser-smoke.ts` runs only synthetic
local browser data; its success is not evidence of provider or staging availability.

```powershell
pnpm run detail:local-browser-smoke
pnpm run detail:local-sql-smoke
pnpm exec tsc -p tsconfig.staging.json --noEmit
pnpm run test:e2e:staging
pnpm run verify:staging:hosted
```

Acceptance samples are in `tests/fixtures/match-detail-staging-targets.ts`: completed Manchester
United/Ipswich and upcoming AFC Bournemouth/Brentford at 2026-09-12 14:00 UTC. The upcoming gate
fails if the sample is missing, rescheduled or has started. Replace it deliberately using fresh
verified current-season evidence; do not skip the assertion. These two samples do not establish
uniform detail coverage across all 45 competitions. Santos/Cruzeiro exposed conflicting canonical
and provider names/kickoffs during acceptance; its payload was rejected and no detail was cached.
Neither side is declared correct by that observation. Canonical revalidation is separate from detail.

Local exit evidence: `verify:staging` passed 157 unit files / 796 tests, all integration/endpoint/PWA
checks and static build. Actual PostgreSQL detail and Edge auth/Postgres smokes passed. Edge graph,
TypeScript staging check and the 67-file static artifact check passed (416,690 total bytes; largest
54,421 bytes). Every TDD slice and corrective slice was independently reviewed and committed locally.

Rollback baseline: Worker `bc4eb715-e26c-45db-833c-84785bf74443` and the Edge v11 bundle SHA-256
`c821b7aaa47d414dcdb1fbc45ef09e32a0f65ab4cc07e645eaadcf129e9c6885`. The detail bundle SHA-256 is
`4bc8fdfdcbf0564582a168ce089a57b6bf7270d4cdaf3208ef7dd5f5c5a295ba`. Keep both bundles in ignored
local backup directories before another runtime deployment.

| Drill step (UTC, 2026-09-10) | Observed result |
| --- | --- |
| Unschedule | Zero jobs; four Vault names, 11,163 matches, 35 snapshots and two cached details retained |
| Baseline Worker and Edge restored | Baseline owner/LIVE E2E passed; new detail gate failed because the old UI sends no POST |
| Detail Edge restored | Bundle verified; new detail gate still failed while old Worker remained active |
| Detail Worker restored, 02:10:59.845 | Full browser E2E passed, both real detail samples returned `not_modified` |
| Scheduler restored, 02:11:21.805 | Three jobs, four Vault names, 11,163 matches, 35 snapshots and two cached details; zero bets/ledger entries |

An expected old-version detail failure is rollback evidence, never a passing current candidate.

The final combined hosted gate passed at `2026-09-10T06:11:26.413Z`: real detail, explicit fault
fixtures, owner logout/replay and network redaction passed; scheduler checks verified four Vault
names and three exact jobs, with controlled current/terminal/live 2xx deliveries and valid `fresh`
no-ops. Owner feedback is the next phase. Production/Tokyo and historical hydration remain unapproved.

## 2026-09-09 hosted refresh and LIVE acceptance gate

The owner authorized this branch's Frankfurt migration/deploy/rollback work.
The completed scope is recorded in `docs/superpowers/plans/2026-09-09-hosted-provider-refresh-live.md`.
Only three bounded Edge refresh jobs replace the historical hourly scheduler. Full filesystem
hydration remains local; the hosted coordinator reads DB canonical rows and publishes deltas in
one fenced transaction. Current TTL remains 24 hours, hard request cap nine, Edge default three.

Apply migrations `20260909120000` through `20260909150000` forward-only. The migrations add
provider control/lease state, scheduler functions, background-live reason/circuit code and hashed
session revocations. They do not schedule jobs or delete match/owner data.

Add one independently generated `MIRAICHI_PROVIDER_REFRESH_TOKEN` to the gitignored Edge deployment
env file and Supabase secrets. Store the same value in Vault as `miraichi_provider_refresh_token`.
Keep the existing three Vault values. The browser and Cloudflare never receive this token.
After the reviewed Edge/Worker code is deployed, call `miraichi_app.configure_hosted_refresh()`.
It replaces the old hourly job with exactly these jobs:

| Job | Cadence | Protected operation |
| --- | --- | --- |
| miraichi-current-refresh | Every five minutes | Current-only TTL/ETag revalidation |
| miraichi-terminal-refresh | Every minute | Due ledger; at least two minutes between date requests |
| miraichi-live-refresh | Every five minutes | SportScore widget refresh; shared 60-second manual floor |

For future runs, put `STAGING_URL` and `MIRAICHI_OWNER_PASSWORD` in the existing gitignored root
`.env` once. Both commands load it automatically. Never pass root `.env` wholesale to deployment.
The password remains local and is not a build variable. A missing URL/password or localhost URL
fails; nothing is skipped. Install the pinned browser with `pnpm exec playwright install chromium`.

```powershell
pnpm run provider:local-sql-smoke
pnpm exec tsc -p tsconfig.staging.json --noEmit
pnpm run test:e2e:staging
pnpm run verify:staging:hosted
```

The committed browser suite lives in `tests/e2e/staging-owner-flow.ts`. It tests the real hosted
owner flow and separately identifies deterministic browser response fixtures for live/halftime/
suspended/completed and empty states; those fixtures are never represented as provider availability.
No owner bankroll/bet data is created. Finally logout/context cleanup is mandatory and a cleanup
failure fails the gate. No password, cookie, token, report trace, screenshot or video is recorded.
The scheduler smoke checks exact Vault/job names, controlled pg_net 2xx delivery and checkpoint/
last-good evidence; it prints no secret.

Rollback: unschedule with `miraichi_app.unschedule_hosted_refresh()`, retain Vault/control/snapshots,
restore the recorded prior Worker version and prior Edge source. Old hourly configuration remains
available only as the explicit rollback path. Restore current Edge/Worker, call configure again,
then rerun the full hosted gate. Record actual results below; never treat an expected rollback
regression as a passing current candidate.

## Current retained state

- Supabase project: `Miraichi Staging`
- Project ref: `qpexxwmrnreooxftfucv`
- Region: Frankfurt
- Remote applied migrations: thirteen versions through `20260909170000`
- Verified cloud data at `2026-09-10T06:12:07.605Z`: 11,163 matches, 45 competitions, 35 snapshots,
  two detail caches; zero drafts, bets, bankroll accounts and ledger entries
- Current-edition checkpoint keys: 45
- Edge Function: `miraichi-api`, ACTIVE version 14 after detail rollback restoration
- Worker: `e735457e-245f-474f-8df3-965be8eb6041`, 100% of staging traffic
- Scheduler: exactly four Vault names and three active jobs using the table above
- Data API: disabled in hosted staging
- Local CA: `.secrets/supabase-staging-ca.crt` (gitignored; used only by owner-local DB tooling)

Do not delete or reset this project. Do not move the CA into source control.

## Recorded Frankfurt acceptance and rollback — 2026-09-09

The previous candidate was rejected by the owner. The replacement uses the existing Frankfurt
project and Cloudflare origin; the code remains on `feat/api-football-rapid-ingestion`. All times
in this section are UTC.

- Final `verify:staging` passed 150 unit files / 733 tests, every integration suite, endpoint E2E,
  PWA checks, lint/types/audits and static build. Local PostgreSQL concurrent lease, fenced atomic
  publication, expired lease, rollback and mandatory cleanup tests passed; actual Edge runtime
  PostgreSQL/auth smoke and the filesystem-free bundle graph passed during implementation.
- `verify:staging:hosted` passed at `01:23:40.919Z` with current `fresh`, terminal `refreshed`, live
  `fresh`. After the complete rollback/restore, it passed again at `04:38:29.867Z`, with all three
  controlled pg_net deliveries returning 2xx and valid `fresh` no-ops. Vault names, job commands,
  cadence, checkpoint revision, request caps and live snapshot freshness were checked explicitly.
- The real Chromium owner flow passed static/API health, wrong/correct login, hardened cookie,
  four tabs, LIVE refresh and retained filters, secret/locator/header redaction, logout and saved
  cookie replay denial. Valid live/halftime/suspended score/minute and empty rendering also passed
  through explicitly identified browser fixtures; they do not claim upstream live availability.
- E2E created no bankroll/bet data. Finally logout/context/browser cleanup passed. No password,
  session cookie, token, screenshot, video or trace is stored in the evidence.
- Independent read-only verification at `04:39:12.274Z` confirmed 11,163 matches, 45 competitions,
  17 snapshots, exactly four Vault names/three active jobs and zero bet drafts, bets, bankroll
  accounts or ledger entries. The fresh remote migration list matched all eleven tracked versions.
- The restored static artifact passed: 64 files, 386,336 total bytes, largest file 55,154 bytes.

| Rollback operation | Observed result |
| --- | --- |
| Unschedule hosted refresh | Zero jobs; all four Vault names, 11,163 matches and 17 snapshots retained |
| Prior Worker `1c71033f-f97f-42b9-9884-1862d64ad870` at 100% | Committed browser E2E passed login/four tabs, failed at expected missing LIVE control |
| Exact prior `f3113ed` Edge source deployed as version 10 | ACTIVE; browser repeated the same expected old-UI failure on forward migrations |
| Current Worker restored with old Edge | LIVE and empty state passed; saved cookie replay check failed as expected for old auth |
| Current Edge restored as version 11 | ACTIVE; full browser E2E passed at `04:35:15.781Z` |
| Scheduler configured again | Exactly three active jobs and unchanged data counts at `04:35:38.278Z`; complete hosted gate then passed |

The old-version browser failures prove the known rollback limitations and are not acceptance
passes. No schema rollback, match/snapshot removal or Vault deletion occurred. Rollback Edge bundle
SHA-256: `d412c24855ef926b2295b7a49b18beafd72852843710660bbbc8e0ba61cc575c`.
Restored bundle SHA-256: `c821b7aaa47d414dcdb1fbc45ef09e32a0f65ab4cc07e645eaadcf129e9c6885`.
The detached rollback source is retained in gitignored `.worktrees/hosted-refresh-rollback`.

The new candidate is ready for the requested `phase:owner-feedback`. The owner must accept or
reject it explicitly. No production/Tokyo action is authorized by this evidence.

## Recorded Frankfurt staging state — 2026-09-08

- Reviewed Git source through `caa853f` is pushed on `feat/api-football-rapid-ingestion`.
- Supabase Edge Function: `miraichi-api`, function ID
  `0e192eca-fc8e-4fe3-be44-748ef9a68609`, active version 5, Frankfurt execution verified.
- Cloudflare origin: `https://miraichi-owner-gateway-staging.quylang88.workers.dev`; active Worker
  version `1c71033f-f97f-42b9-9884-1862d64ad870` at 100% traffic.
- Vault has exactly the three scheduler names. Cron job ID 2 is active at `17 * * * *`; its command
  exactly calls `miraichi_app.invoke_edge_hourly_live_refresh()`.
- GitHub Actions keeps only `workflow_dispatch`; its duplicate hourly schedule was removed after
  real cron deliveries succeeded.
- No Tokyo project, custom domain, paid service, production promotion, reset, or deletion occurred.

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

Hosted operation also requires two independent random values:

- `MIRAICHI_GATEWAY_TOKEN` (at least 32 random bytes)
- `MIRAICHI_PROVIDER_REFRESH_TOKEN` (independent of gateway, session and live-refresh values)

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
3. Create gitignored `.secrets/edge.staging.env` with the exact runtime names below. It contains five
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
MIRAICHI_PROVIDER_REFRESH_TOKEN=<INDEPENDENT_PASSWORD_MANAGER_VALUE>
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
$MiraichiWorkerOrigin = "https://miraichi-owner-gateway-staging.quylang88.workers.dev"
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

For the first deployment only, `versions upload` cannot create a Worker that does not yet exist.
Frankfurt staging therefore used one explicit fail-closed bootstrap deployment with a known
non-secret placeholder gateway value, then created and activated a secret-bearing version. Do not
reuse that bootstrap path once the Worker exists.

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

## 6. Vault-backed hosted refresh cron

The tracked migration creates but does not call these owner-only functions:

- `miraichi_app.configure_hosted_refresh()`;
- `miraichi_app.invoke_hosted_refresh('current' | 'terminal' | 'live')`;
- `miraichi_app.unschedule_hosted_refresh()`.

It resolves exactly these Vault names at execution time:

- `miraichi_edge_function_url`;
- `miraichi_edge_gateway_token`;
- `miraichi_live_refresh_token`.
- `miraichi_provider_refresh_token`.

Local migration and disposable scheduler verification is repeatable with:

```powershell
pnpm exec supabase migration up --local --include-all
pnpm run provider:local-sql-smoke
pnpm run detail:local-sql-smoke
pnpm exec supabase db lint --local --schema miraichi_app --level warning --fail-on error
pnpm exec supabase db advisors --local --type security --fail-on error
```

These verification commands use the disposable local database. Apply remote migrations only through
the reviewed forward migration procedure above.

Frankfurt Vault configuration and scheduling remain owner staging actions.

Only after the Edge function works:

1. Put the Edge Function URL, gateway token, live refresh token and provider refresh token into Vault
   under the exact names defined by the tracked migration/operation contract.
2. Call `configure_hosted_refresh()` to enable exactly the three jobs in the cadence table above.
3. Inspect `cron.job` to confirm exact names, schedules and commands, then run the committed hosted gate.
4. Verify `cron.job_run_details` and the corresponding `pg_net` result without selecting decrypted
   Vault values into logs.
5. Confirm current/terminal/LIVE controlled deliveries return 2xx with valid fresh/refreshed results,
   request caps, durable checkpoints and last-good freshness. Detail has no cron job.
6. Keep the superseded GitHub Actions schedule disabled; `workflow_dispatch` remains available.

After the four Vault values exist, enable or disable the three jobs with separate operations:

```sql
select miraichi_app.configure_hosted_refresh();
```

```sql
select miraichi_app.unschedule_hosted_refresh();
```

The older `configure_edge_hourly_live_refresh()` function is retained only for explicitly selected
historical rollback. Do not call it on the current candidate: it can add a fourth job. A runtime
rollback in this phase pauses all three current jobs, then restores those same three jobs.

If refresh loops, fails repeatedly, or targets the wrong route/region, unschedule hosted refresh and
diagnose. Never delete canonical matches or the last-good live overlay as recovery.

## 7. Rollback drill

Before declaring staging complete:

- Record the last-good Git commit, Supabase function deployment ID, Cloudflare Worker version ID,
  cron job names, and snapshot ID.
- Prove Cloudflare can restore the prior version with
  `wrangler versions deploy <VERSION_ID>@100% --env staging`.
- Prove the prior reviewed Edge function source can be redeployed from Git.
- Prove all three cron jobs can be unscheduled without deleting Vault or application data.
- Keep database migrations forward-only; use a reviewed compensating migration, never a linked reset.

Gateway secret rotations must be coordinated. A mismatched Cloudflare/Edge/Vault value intentionally
causes an outage; the recovery is restoring matching secret versions, not bypassing authentication.

### Recorded rollback and staging smoke — 2026-09-08

- Cloudflare rolled back from `1c71033f-f97f-42b9-9884-1862d64ad870` to prior working version
  `4824619d-6a8e-4857-a1c5-7d79de289108`; health remained `200`. The remediated version was then
  restored to 100% traffic, health remained `200`, `Cache-Control` remained `no-store`, and no
  observed Supabase runtime header was exposed.
- The clean reviewed Edge source at commit `caa853f` rebuilt and passed graph verification. The
  follow-up deploy command reported no byte change; a subsequent independent function-list check
  recorded deployment ID `0e192eca-fc8e-4fe3-be44-748ef9a68609` as `ACTIVE` version 5.
- The cron unschedule drill removed the only job while retaining all three Vault names, and the
  configure function restored one exact active job as job ID 2. A controlled post-restore pg_net
  request returned `200 fresh`; earlier natural runs at minute 17 were recorded as succeeded.
- The first controlled delivery exposed and stopped on a JSONB driver mismatch. `postgres.js` had
  encoded Node-oriented JSON strings as JSON scalars. Commit `caa853f` now brands JSON parameters
  and lets Node `pg` stringify while the Edge driver uses its JSON encoder. Remote live refresh then
  returned `200 refreshed`, and the complete owner write/settlement/backup smoke passed.
- Static/root/deep-route/API health checks and authenticated login/session/cloud/snapshot/matches/
  bankroll/draft/bet/settlement/backup/live/logout checks all passed through the Worker origin.
  Disposable owner rows were deleted after proof; bankroll, bet, draft, backup-log, and discipline
  counts returned to zero. A 200-row Edge log inspection matched zero configured secret values.
- `pnpm run verify:staging` passed with 141 unit files/705 tests, all integration suites, endpoint
  E2E, PWA verification, audits, typecheck, and the final static build.

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
