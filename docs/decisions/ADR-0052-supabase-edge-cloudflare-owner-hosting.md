# ADR-0052: Supabase Edge Function And Cloudflare Worker Owner Hosting

* **Status**: Accepted
* **Date**: 2026-09-03
* **Owner approval**: Explicitly approved Supabase Edge Function plus Cloudflare Worker Static
  Assets, a free `*.workers.dev` staging origin, one gateway-token boundary, Supabase Cron + Vault,
  retained Frankfurt staging, and a later owner-approved Tokyo production cutover.
* **Supersedes**: ADR-0051 only for Koyeb hosting and GitHub Actions hourly wake-up.
* **Preserves**: ADR-0051 owner password/session, widget-only live overlay, refresh cooldown,
  attribution, provider-neutral persistence, and pending historical/detail boundaries.

## Context

The current hosted implementation is a Node HTTP server that serves both the static PWA and API.
Its routes use Node `IncomingMessage`/`ServerResponse`; the persistence client uses `pg`; startup and
fallback repositories import filesystem APIs; and password verification uses `node:crypto.scrypt`.
That code passed local and integration gates but is not an Edge Function bundle.

The Frankfurt Supabase staging database is already migrated and contains the verified 10,899-match,
45-competition snapshot. It must not be deleted. The intended Koyeb staging deployment cannot be
used by this owner: Koyeb's official
[2026 transition announcement](https://www.koyeb.com/blog/koyeb-is-joining-mistral-ai-to-build-the-future-of-ai-infrastructure)
says new users must provide a payment method and subscribe to a paid plan, which the owner rejected.
Koyeb still documents a Free Instance for eligible organizations, so the precise conclusion is that
this project's Koyeb path is blocked, not that Free Instances universally ceased to exist.

Official platform documentation supports the replacement direction:

- Supabase Edge Functions are TypeScript on Deno, expose `SUPABASE_DB_URL`, document direct Postgres
  clients, and show `postgres` with prepared statements disabled for transaction pool mode:
  [database integration](https://supabase.com/docs/guides/functions/connect-to-postgres) and
  [Edge secrets](https://supabase.com/docs/guides/functions/secrets).
- Supabase supports regional invocation through `x-region`, including Frankfurt `eu-central-1` and
  Tokyo `ap-northeast-1`:
  [regional invocations](https://supabase.com/docs/guides/functions/regional-invocation).
- Supabase documents `pg_cron` + `pg_net` Edge invocation with credentials in Vault:
  [scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).
- Cloudflare Worker Static Assets support SPA fallback and selective worker-first routing for
  `/api/*`:
  [Static Assets configuration](https://developers.cloudflare.com/workers/static-assets/binding/).

These documents establish supported APIs, not compatibility evidence for Miraichi's exact code.

## Decision

### 1. Runtime and routing

Use Web-standard `Request` and `Response` as the canonical API boundary. Keep the Node server as a
local runtime adapter; add one Deno TypeScript entrypoint for one Supabase Edge Function. The Edge
bundle may import provider-neutral services, contracts, and cloud repositories, but it must not
import the hosted static server, local serving store, local match-detail store, local refresh queue,
or any other filesystem-dependent module.

One function owns the complete `/api/v1/*` router. This reduces deployment mismatch and function
cold-start fan-out. Historical-season hydration and full-season current hydration remain owner-local
operations and never enter the function. Lazy match detail stays pending; Edge behavior must report
unavailable/pending state honestly without creating an ephemeral filesystem queue.

### 2. Cloudflare same-origin gateway

Deploy one TypeScript Cloudflare Worker with the existing `apps/web/dist` output as Static Assets.
Use asset-first delivery and SPA fallback. Configure worker-first routing for both exact `/api` and
`/api/*`; no other asset request should spend Worker CPU.

For API requests the Worker:

1. builds an upstream URL from one fixed Supabase origin and one fixed function name;
2. preserves the incoming method, query, body stream, `Cookie`, and public `Origin`;
3. removes/overwrites every internal gateway and region header supplied by the client;
4. adds the Cloudflare secret gateway token and the configured `x-region` value;
5. performs exactly one upstream subrequest with redirects disabled;
6. streams status/body back, preserves every `Set-Cookie` header separately, strips internal
   headers, and forces `Cache-Control: no-store` for `/api` responses.

The staging site uses Cloudflare's free `*.workers.dev` origin. Static source files are public, as
they were in the Koyeb design; owner data remains behind API authentication.

### 3. Gateway token and owner authentication

Set `verify_jwt = false` for the Miraichi Edge Function because the browser has a Miraichi session
cookie rather than a Supabase user JWT. Supabase warns that this removes its default JWT gate:
[function configuration](https://supabase.com/docs/guides/functions/function-configuration).

Compensate with a separate `MIRAICHI_GATEWAY_TOKEN` of at least 32 random bytes. Store it only as a
Cloudflare Worker secret, a Supabase Edge secret, the owner's password-manager value, and a Vault
copy for cron. The Edge entrypoint compares a digest in constant time before URL routing, request
body parsing, database access, or SportScore access. Missing, duplicate, or incorrect tokens return
an indistinguishable authorization failure. The direct Edge URL remains public at the network level
but cannot invoke application behavior without this token.

The gateway token authenticates the proxy, not the owner. Preserve the existing one-owner password,
`__Host-miraichi_owner` Secure/HttpOnly/SameSite=Strict cookie, signed session, no registration, and
refresh-only `MIRAICHI_REFRESH_TOKEN`. Health and auth bootstrap are exempt from owner-session auth
but are still behind the Cloudflare-to-Edge gateway boundary. Cron needs both gateway and refresh
tokens; a public caller through Cloudflare cannot use the hourly endpoint without the refresh token.

The Edge runtime accepts only the exact configured Cloudflare public origin for browser-originated
requests. It does not need to return cross-origin permission to the browser because the browser sees
one origin. Direct cross-origin calls still fail the gateway check.

### 4. PostgreSQL persistence

Keep the hosted Data API disabled and keep the browser away from Postgres. Use the Edge runtime's
automatically provisioned `SUPABASE_DB_URL`; do not copy a database password to Cloudflare. Use the
Supabase-documented `postgres` package with `prepare: false`, one bounded connection per isolate,
bounded connect/idle lifetime, parameter arrays, and `sql.begin` for the existing transaction
contract. Deployed Edge Functions are preconfigured by Supabase for database SSL, so the existing
project CA remains only for owner-local snapshot sync and diagnostics.

This choice is conditional on RED/GREEN evidence in the actual local Supabase Edge Runtime:

- parameterized reads and writes preserve the current `PostgresQueryClient` semantics;
- successful multi-statement work commits atomically;
- an injected failure rolls back every statement;
- transaction-mode restrictions do not create prepared-statement errors;
- connections close/reuse without leaking across requests.

If `SUPABASE_DB_URL` or `postgres` fails those checks, stop and revise this ADR. Do not silently turn
on the Data API, introduce a service-role browser client, disable TLS verification, or substitute a
different driver.

### 5. Crypto compatibility gate

Deno's official Node compatibility reference lists `node:crypto.scrypt`, HMAC, random bytes, and
timing-safe comparison: [Deno `node:crypto`](https://docs.deno.com/api/node/crypto/). Supabase still
limits hosted requests to 2 seconds CPU and 256 MB memory:
[Edge Function limits](https://supabase.com/docs/guides/functions/limits).

Therefore documentation is not enough. Before porting all routes, run the exact existing
`scrypt-v1` verification parameters (`N=16384`, `r=8`, `p=1`, 64-byte key, 64 MiB maxmem), session
HMAC, base64url/Buffer behavior, and timing-safe checks inside the local Supabase Edge Runtime. The
Frankfurt staging smoke must repeat successful and failed login and record function outcome/latency
without logging the password, hash, session, or token. Failure blocks deployment; weakening the
stored hash is not an automatic fallback.

### 6. Region placement

Cloudflare and cron overwrite `x-region` with `eu-central-1` for Frankfurt staging. Database-heavy
functions otherwise execute near the caller, which could place Japanese browser invocations in
Tokyo while their database remains in Frankfurt and multiply cross-region database latency. The
response `x-sb-edge-region` is checked during smoke.

For the later production cutover, create a separate Tokyo Supabase project only after Frankfurt
staging is green and the owner approves production preparation. Apply migrations, sync the exact
snapshot, configure independent secrets/Vault, deploy the same function, and switch the Cloudflare
production environment to `ap-northeast-1`. Retain Frankfurt unchanged for rollback.

### 7. Hourly refresh

Use one tracked, idempotent hourly cron contract at minute 17. `pg_cron` invokes `pg_net`, which
resolves the Edge URL, gateway token, and refresh token from Vault at execution time and calls only
`POST /api/v1/live/refresh?reason=hourly`. The request also pins the database region. No literal
secret appears in a migration, `cron.job.command`, log, or documentation.

The existing GitHub Actions wake-up becomes superseded after cron passes staging smoke. Visible
five-minute refresh and pull-to-refresh remain unchanged and continue to share the durable lease.
Cron failure makes live data stale; it must never delete canonical or last-good live data.

### 8. Quotas and capacity

The measured PWA build is 63 files and 385,801 bytes. Cloudflare Workers Free permits 20,000 static
files per version, 25 MiB per file, 100,000 Worker invocations/day, 10 ms CPU/request, 50
subrequests/request, and 128 MB memory:
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/). Static asset requests
are free and unlimited; selective `/api` worker-first requests consume the Worker quota:
[Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

Supabase Free includes 500,000 Edge invocations/month and 5 GB egress; the staging database currently
uses 17 MB against the 500 MB database quota:
[Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase).
A continuously visible five-minute refresh is at most 288 calls/day and hourly cron adds 24/day, so
the owner-only expected load is materially below these quotas. That is a planning inference, not an
SLA; normal API calls, retries, failed invocations, and provider payload egress still count.

## Failure Modes And Required Response

| Failure | Observable effect | Required behavior |
| --- | --- | --- |
| Cloudflare Worker quota/runtime failure | Static shell may load while `/api` returns an edge error | Static assets remain asset-first; no alternate public API URL is exposed |
| Gateway token mismatch | Every proxied API call fails authorization | Roll back/reapply matching secret versions; never bypass the check |
| Cookie forwarding regression | Login succeeds upstream but browser loops to login | Fail staging smoke; preserve separate `Set-Cookie`, `Cookie`, and `__Host-` semantics |
| Edge crypto incompatibility/CPU limit | Login fails or function terminates | Stop implementation; do not reduce hash strength without a new owner decision |
| Postgres driver/TLS/transaction failure | Owner routes return 503 | Preserve data and rollback; never disable TLS validation or partially emulate transactions |
| Wrong Edge region | High latency/timeouts, no intended data change | Verify `x-sb-edge-region`; correct the server-controlled region setting |
| Cron/Vault/pg_net failure | Closed-app live overlay becomes stale | Inspect cron/pg_net status, keep last-good state, and retain visible/manual refresh |
| SportScore widget failure/coverage gap | Partial or stale live overlay | Preserve existing last-good and provider-neutral rules |
| Supabase quota/read-only state | Reads may continue while writes fail | Stop writes, export/restore safely, and require owner action; do not delete active data |

## Rollback

- Deploy Edge before Cloudflare so the old public origin is never pointed at missing API behavior.
- Tag the Git commit and record the Supabase function deployment ID plus Cloudflare version ID for
  every staging deployment. Supabase rollback means redeploying the prior reviewed function source;
  Cloudflare supports `wrangler rollback` to a prior Worker version.
- If the new gateway fails, roll Cloudflare back first or restore the matching gateway secret, then
  redeploy the prior Edge source. Do not roll back by resetting Supabase or deleting match data.
- Unschedule the named cron job when isolating background failures; do not remove Vault secrets until
  the previous invocation is confirmed stopped and rollback is complete.
- Database migrations remain forward-only. Any schema-bearing slice requires its own recovery SQL,
  owner backup, and explicit staging evidence before application.
- Frankfurt remains the production-cutover rollback source until Tokyo has a verified backup,
  migrations, snapshot, authenticated flow, hourly refresh, and explicit owner acceptance.

## Rejected Alternatives

- **Continue Koyeb**: conflicts with the owner's no-paid-plan decision for a new Koyeb account.
- **Browser calls Edge directly**: breaks same-origin cookie behavior and exposes the backend URL as
  the application boundary.
- **Cloudflare stores the database password**: violates the thin proxy boundary.
- **Enable Data API/service-role browser access**: expands attack surface and violates the existing
  private-schema/API mediation contract.
- **One Edge Function per route**: increases deployment and cold-start coordination without owner
  scale requiring it.
- **Run full-season hydration in Edge**: incompatible with the 2-second CPU boundary and the
  owner-controlled hydration contract.
- **Create Tokyo now or delete Frankfurt**: removes verified staging/rollback state before the new
  runtime has any hosted evidence.

## Evidence Classification

- **Facts**: current Git/code shape, 63-file/385,801-byte build, Frankfurt snapshot counts, and the
  linked provider limits/capabilities.
- **Inference**: owner-only traffic should remain well below published quotas.
- **Unverified assumptions**: exact Edge crypto performance, Postgres adapter/transaction behavior,
  cookie round trip, hosted region pinning, and Vault cron call.
- **Required next action**: write the exact implementation plan; then prove each assumption through
  sequential RED/GREEN slices before any staging deployment.
