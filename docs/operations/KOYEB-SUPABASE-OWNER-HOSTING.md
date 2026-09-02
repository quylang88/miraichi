# Koyeb + Supabase owner hosting runbook

Verified against the official provider documentation on 2026-09-02. This runbook creates one
HTTPS origin for the Miraichi PWA and API. It does not authorize an automated production deploy:
review and push the local commits yourself before connecting Koyeb.

## What this setup actually provides

- Koyeb runs one public Web Service and supplies a generated `*.koyeb.app` HTTPS URL.
- The same Node process serves both the PWA and `/api/*`; browser requests stay same-origin.
- Supabase stores owner bankroll/bet state, the canonical current-match snapshot, the live overlay,
  and the cross-instance refresh lease.
- GitHub Actions sends one best-effort hourly wake-up/refresh request at minute 17.
- While the app is visible, the browser flow refreshes every five minutes. That flow is independent
  from the hourly operation.

Koyeb documents that every App receives a public `koyeb.app` subdomain and TLS at its edge:
[Apps](https://www.koyeb.com/docs/reference/apps). Its Free Instance is limited to one per
organization, 512 MB RAM/0.1 vCPU/2 GB SSD, is hobby/testing capacity, and sleeps after one hour
without traffic: [Instances](https://www.koyeb.com/docs/reference/instances). This is usable for the
owner MVP, but it is not production-grade availability.

## 0. Local preflight

From PowerShell in the repository root:

```powershell
cd C:\CODE\miraichi
git status --short
git log -8 --oneline
pnpm install --frozen-lockfile
pnpm run verify:release
pnpm run build:web-static
pnpm run data:validate:serving:matches
```

Do not continue if `verify:release`, the static build, or serving-data validation fails. The current
generated serving data is intentionally gitignored; it must be uploaded to Supabase in step 2.

## 1. Create and migrate the Supabase Free project

1. Sign in to Supabase, create a Free organization/project, choose a region reasonably close to the
   Koyeb region, create a strong database password, and save it in a password manager.
2. In the project dashboard select **Connect** and copy the **Session pooler** connection string on
   port `5432`. Use this for the persistent Koyeb Node process and append `?sslmode=require` if the
   copied URL has no query string. Do not put an anon key, service-role key, or database URL in web
   code.
3. Copy the project ref from Project Settings. Then run:

```powershell
cd C:\CODE\miraichi
pnpm exec supabase login
pnpm exec supabase link --project-ref <YOUR_PROJECT_REF>
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
pnpm exec supabase migration list
```

Read the dry-run output before applying. `supabase db push` applies only pending local migrations;
the official workflow is documented at [Supabase CLI workflows](https://supabase.com/docs/guides/local-development/cli-workflows).
Supabase recommends the shared Session pooler for persistent backends that need IPv4:
[Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres).

Do not run any remote reset command against this project. After it contains owner data, export a
Miraichi backup before every schema change.

## 2. Upload the current canonical match snapshot once

The live adapter refuses to guess identities. If Supabase has no canonical current matches, live
widget records cannot be published even when SportScore returns them. Upload the already-validated
local serving snapshot before deploying:

```powershell
$env:APP_ENV='local'
$env:CLOUD_PERSISTENCE_MODE='supabase'
$env:SUPABASE_DATABASE_URL='<SESSION_POOLER_URL_WITH_SSLMODE_REQUIRE>'
$env:MIRAICHI_OWNER_PROFILE_ID='owner-primary'
pnpm run data:validate:serving:matches
pnpm run data:sync:serving:cloud
Remove-Item Env:\SUPABASE_DATABASE_URL
Remove-Item Env:\CLOUD_PERSISTENCE_MODE
Remove-Item Env:\MIRAICHI_OWNER_PROFILE_ID
Remove-Item Env:\APP_ENV
```

Check that the command reports the expected snapshot and match count. This is an upsert; it does not
delete the active local data. Current-season revalidation remains a separate ingestion operation.
Historical-season hydration and lazy full match detail remain pending.

## 3. Generate the three application secrets locally

Generate two independent random values; never reuse the owner password:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store the first as `MIRAICHI_SESSION_SECRET` and the second as `MIRAICHI_REFRESH_TOKEN` in the
password manager. To derive the owner password hash without writing the plaintext password to a
file:

```powershell
$securePassword = Read-Host 'Owner password (minimum 12 characters)' -AsSecureString
$credential = [PSCredential]::new('owner', $securePassword)
$env:MIRAICHI_OWNER_PASSWORD = $credential.GetNetworkCredential().Password
pnpm run auth:hash-password
Remove-Item Env:\MIRAICHI_OWNER_PASSWORD
$credential = $null
$securePassword = $null
```

Copy only the resulting `scrypt-v1...` value as `MIRAICHI_OWNER_PASSWORD_HASH`. Treat the hash as a
secret too. Do not commit any of these values or print them in CI logs.

## 4. Put the reviewed commits on GitHub

Koyeb cannot deploy commits that exist only on this machine. After reviewing the local commit chain,
push the chosen branch to a private GitHub repository yourself. Do not enable Koyeb auto-deploy until
you are comfortable that every push to that branch is a deployment candidate. The hourly workflow
must ultimately exist on the repository's default branch because GitHub only schedules workflows
from that branch: [scheduled workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## 5. Create the Koyeb Web Service and get the API URL

1. Sign in to Koyeb and connect its GitHub integration only to the Miraichi repository.
2. Click **Create Web Service** -> **GitHub**, select the repository and reviewed branch.
3. Choose **Buildpack**. Leave Work directory at the repository root; using `apps/api` would omit
   workspace packages required by the monorepo.
4. Set Build command to `pnpm run build:web-static`.
5. Set Run command to `pnpm run start:hosted`.
6. Select the **Free** instance. Pick Washington, D.C. or Frankfurt according to the closest available
   Supabase region; do not pretend either is low-latency from Japan.
7. Expose port `8000` using HTTP, route `/` to that port, and configure an HTTP GET health check at
   `/api/v1/health`.
8. In Koyeb Secrets create four secrets containing the values from earlier steps:
   `SUPABASE_DATABASE_URL`, `MIRAICHI_OWNER_PASSWORD_HASH`, `MIRAICHI_SESSION_SECRET`, and
   `MIRAICHI_REFRESH_TOKEN`.
9. Add the following runtime environment configuration. For secret-backed values, select the Koyeb
   secret/reference rather than pasting a literal into a public configuration field.

```dotenv
APP_ENV=production
NODE_ENV=production
PORT=8000
HOSTED_WEB_MODE=required
HOSTED_WEB_ROOT=apps/web/dist
CLOUD_PERSISTENCE_MODE=supabase
SUPABASE_DATABASE_URL={{ secret.SUPABASE_DATABASE_URL }}
MIRAICHI_OWNER_PROFILE_ID=owner-primary
MIRAICHI_OWNER_AUTH_MODE=password
MIRAICHI_OWNER_PASSWORD_HASH={{ secret.MIRAICHI_OWNER_PASSWORD_HASH }}
MIRAICHI_SESSION_SECRET={{ secret.MIRAICHI_SESSION_SECRET }}
MIRAICHI_SESSION_TTL_SECONDS=604800
SPORTSCORE_LIVE_MODE=widget
SPORTSCORE_WIDGET_TIMEOUT_MS=8000
MIRAICHI_REFRESH_TOKEN={{ secret.MIRAICHI_REFRESH_TOKEN }}
```

Leave `API_URL`, `APP_URL`, and `CORS_ALLOWED_ORIGIN` unset. An empty browser API base means same
origin, and the API listens on `PORT`. There is no wildcard CORS configuration.

10. Click **Deploy**, wait for **Healthy**, then copy the public URL ending in `.koyeb.app`. That URL
    is both the app URL and the API base URL. Koyeb's Git deployment fields and build/run overrides
    are documented at [Deploy with GitHub](https://www.koyeb.com/docs/build-and-deploy/deploy-with-git).

Verify without sending credentials:

```powershell
$apiUrl = 'https://<APP>-<ORG>-<HASH>.koyeb.app'
Invoke-RestMethod "$apiUrl/api/v1/health"
Start-Process $apiUrl
```

The health endpoint must return `status: ok`; the root must show the owner login before loading the
application shell.

## 6. Enable the hourly closed-app refresh

In GitHub open **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.
Create exactly:

- `MIRAICHI_API_URL`: the Koyeb HTTPS base URL, with no `/api` suffix.
- `MIRAICHI_REFRESH_TOKEN`: exactly the same random refresh token stored in Koyeb.

GitHub documents repository secret setup at [Using secrets in GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).
Open **Actions** -> **Hourly live refresh** -> **Run workflow** once. A green run proves the service
token can call only `POST /api/v1/live/refresh?reason=hourly`. It does not grant access to bankroll,
bets, or owner session routes.

The checked-in schedule is `17 * * * *`, intentionally avoiding the beginning of the hour. GitHub
states scheduled work can be delayed or even dropped under high load, so this is best-effort, not an
exact hourly SLA. The curl request has bounded connection/runtime limits and two retries to tolerate
a Koyeb cold start; it never calls SportScore directly and never mutates local serving files.

## 7. Cloudflare decision

**Cloudflare không bắt buộc.** Koyeb already supplies a public HTTPS `koyeb.app` URL, routes the Web
Service, and terminates TLS. Adding Cloudflare now creates another DNS/proxy/cache layer without
solving the free instance's CPU, sleep, GitHub schedule, Supabase, or SportScore coverage limits.

Use Cloudflare later only if you buy/control a custom domain and specifically need its DNS/WAF/CDN
features. Even then, keep `/api/*` and authenticated HTML responses uncacheable and preserve one
origin. Koyeb also supports attaching a custom domain directly with managed TLS:
[Koyeb custom domains](https://www.koyeb.com/docs/run-and-scale/domains).

## 8. Operational limits and recovery

- Opening the app wakes a sleeping Koyeb service. Expect a cold-start delay; the current Koyeb docs
  state deep-sleep wake-up is commonly 1-5 seconds.
- Supabase Free projects may pause after low activity over seven days and Free has no downloadable
  managed backups. Hourly app activity reduces idleness but is not an availability guarantee:
  [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
- SportScore widget live matches are global and capped at 50 records. Miraichi publishes only unique
  mappings to its canonical current snapshot. Therefore live coverage can be partial even when the
  HTTP refresh succeeds.
- A failed provider refresh keeps the last-good overlay. Disappearance from the live list never means
  FT; bounded tracked-match checks are required.
- If a Koyeb deployment is bad, select the previous healthy Deployment in Koyeb. Do not repair an app
  release by wiping Supabase or deleting `apps/api/data`.

After setup, test in this order: health -> owner login -> current matches -> one manual pull-down ->
hourly workflow -> close app -> reopen. Only then treat the generated URL as the usable owner MVP.
