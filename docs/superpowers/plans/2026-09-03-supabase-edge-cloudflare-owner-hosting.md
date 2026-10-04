# Supabase Edge Function And Cloudflare Worker Owner Hosting Implementation Plan

> Owner approved on 2026-09-03. Execute in order. Every slice must first produce the stated RED,
> reach focused GREEN with the smallest implementation, and end in its own local commit before the
> next slice starts. Do not push, deploy, create a Tokyo project, delete Frankfurt, or treat a local
> runtime check as staging approval.

## Fixed implementation decisions

- The canonical API transport boundary is Web-standard `Request -> Promise<Response>`. Node HTTP is
  an adapter and Cloudflare is only a static host plus thin `/api` proxy.
- Supabase receives one function named `miraichi-api`. The deployed URL keeps the function mount
  prefix, while the API router sees only `/api/*` paths after explicit prefix normalization.
- The Edge Function source tree must be self-contained under `supabase/functions`. Because current
  Supabase CLI monorepo/workspace import handling is not a safe contract, a deterministic build
  bundles the selected runtime-neutral API module graph into
  `supabase/functions/_shared/generated/`. Generated output is ignored and rebuilt before local
  serve or deploy. The build fails if the graph reaches Node HTTP, filesystem stores, `pg`, static
  hosting, or another function.
- Edge persistence uses the runtime-provided `SUPABASE_DB_URL` and the version-pinned `postgres`
  package with `prepare: false`, a bounded pool, parameter binding, and explicit transaction
  commit/rollback. Data API remains disabled. Failure of the real Edge runtime probe stops the
  phase; it does not authorize weaker TLS or a different database boundary.
- The custom gateway token is checked in constant time before router construction, body parsing,
  database calls, or provider calls. It is not an owner credential. Hourly refresh additionally
  requires the existing refresh-only bearer token.
- Hosted match detail never reads or writes local filesystem queues. Until the separate pending
  lazy-detail phase is approved, Edge returns factual summary/unavailable behavior from the cloud
  match repository only.
- Staging invocations pin `eu-central-1`; the future Tokyo production value is
  `ap-northeast-1` but is not activated in this plan.

## Slice 1 — Web HTTP primitives

**Files**

- Add `apps/api/src/http/web-http.ts`.
- Add `apps/api/src/http/web-http.test.ts`.
- Modify `apps/api/src/routes/json-body.ts`.
- Modify `apps/api/src/routes/json-body.test.ts`.

**RED observation**

- Focused tests cannot import Web response/error helpers or a bounded `Request` JSON reader.
- The tests require JSON content type, explicit status/headers including repeated `Set-Cookie`,
  malformed/non-object JSON rejection, unsupported media rejection, and a body-size ceiling.

**Minimal implementation**

- Add small constructors for JSON, empty, and error responses plus a bounded JSON-object reader.
- Use only Web APIs and transport-neutral environment record types; do not add routing, auth, DB,
  Cloudflare, or Deno behavior in this slice.

**Focused verification**

- `pnpm exec vitest run apps/api/src/http/web-http.test.ts apps/api/src/routes/json-body.test.ts`
- `pnpm run typecheck`
- `git diff --check`

**Commit**

- `refactor: add web api http primitives`

## Slice 2 — Web API router with a Node compatibility adapter

**Files**

- Add `apps/api/src/api-router.ts` and `apps/api/src/api-router.test.ts`.
- Add `apps/api/src/runtime/api-runtime.ts` and `apps/api/src/runtime/api-runtime.test.ts`.
- Add `apps/api/src/runtime/node-api-adapter.ts` and
  `apps/api/src/runtime/node-api-adapter.test.ts`.
- Add `apps/api/src/runtime/node-runtime-composition.ts` and
  `apps/api/src/runtime/node-match-detail-dependencies.ts`.
- Modify `apps/api/src/index.ts`.
- Modify `apps/api/src/http-origin-boundary.ts` and
  `apps/api/src/http-origin-boundary.test.ts`.
- Modify `apps/api/src/auth/owner-auth.ts`, `apps/api/src/auth/owner-auth.test.ts`,
  `apps/api/src/auth/owner-auth-boundary.ts`,
  `apps/api/src/auth/owner-auth-boundary.test.ts`,
  `apps/api/src/auth/live-refresh-service-auth.ts`, and
  `apps/api/src/auth/live-refresh-service-auth.test.ts`.
- Modify `apps/api/src/routes/cloud-route-types.ts`.
- Add `apps/api/src/routes/ingestion-status.mock.test.ts` and modify all existing route
  implementation/test pairs:
  `health`, `matches`, `match-detail`, `data-snapshot-status`,
  `live-matches`, `cloud-persistence-status`, `bet-drafts`, `bets`, `discipline`, `bet-reports`,
  `bet-settlements`, `bankroll`, and `backups` under `apps/api/src/routes/`.
- Modify `tests/integration/hosted-owner-live-flow.test.ts`.

**RED observation**

- Router tests cannot import the canonical handler and prove exact route precedence, auth-route
  exemption, session protection, refresh-token scoping, CORS rejection, method handling, and JSON
  404 behavior through Web `Request`/`Response`.
- Node adapter tests cannot prove streamed request conversion, repeated response headers, aborted
  requests, or preservation of the existing hosted static fallback.
- Hosted match-detail tests expose filesystem defaults inside the route rather than injected
  Node-only dependencies.

**Minimal implementation**

- Convert all route/auth/origin boundaries to return Web `Response` values and inject their
  dependencies through one runtime composition object.
- Keep existing business behavior and public payloads unchanged; move only Node environment/file
  assembly to the Node composition root.
- Make `index.ts` a thin Node server adapter plus existing static fallback. Keep local detail
  store/queue behavior only in `node-match-detail-dependencies.ts`.

**Focused verification**

- `pnpm exec vitest run apps/api/src/http-origin-boundary.test.ts apps/api/src/auth/owner-auth.test.ts apps/api/src/auth/owner-auth-boundary.test.ts apps/api/src/auth/live-refresh-service-auth.test.ts apps/api/src/routes/*.test.ts apps/api/src/api-router.test.ts apps/api/src/runtime/api-runtime.test.ts apps/api/src/runtime/node-api-adapter.test.ts tests/integration/hosted-owner-live-flow.test.ts`
- `pnpm run hosted:integration`
- `pnpm run typecheck`
- `git diff --check`

**Commit**

- `refactor: route api through web requests`

## Slice 3 — Fail-closed Edge gateway and deterministic function bundle

**Files**

- Add `apps/api/src/auth/edge-gateway-auth.ts` and
  `apps/api/src/auth/edge-gateway-auth.test.ts`.
- Add `apps/api/src/runtime/edge-runtime-composition.ts` and
  `apps/api/src/runtime/edge-runtime-composition.test.ts`.
- Add `scripts/build-supabase-edge-function.ts` and
  `scripts/build-supabase-edge-function.test.ts`.
- Add `scripts/verify-supabase-edge-module-graph.ts` and
  `scripts/verify-supabase-edge-module-graph.test.ts`.
- Add `supabase/functions/miraichi-api/index.ts`.
- Add `supabase/functions/miraichi-api/deno.json`.
- Modify `supabase/config.toml`, `.gitignore`, root `package.json`, and `pnpm-lock.yaml`.

**RED observation**

- Gateway tests cannot import a verifier and require missing, empty, duplicate, and wrong tokens to
  return the same generic 401 without constructing downstream runtime dependencies; only one exact
  token continues.
- Bundle tests cannot build an Edge entry or detect forbidden `node:http`, filesystem, `pg`, hosted
  static server, local serving/detail stores, and cross-function imports.
- `supabase functions serve miraichi-api` cannot boot the missing function, and
  `config.toml` does not yet declare `verify_jwt = false` for exactly that function.

**Minimal implementation**

- Implement constant-time gateway verification with a minimum secret length and no secret-bearing
  log/error text. Validate it before lazy creation of the API runtime.
- Add one version-pinned function-local dependency map and a deterministic esbuild step producing
  ignored code only below `supabase/functions/_shared/generated/`.
- Normalize only `/functions/v1/miraichi-api` from the upstream URL before passing the request to
  the canonical router. Do not add persistence in this slice.

**Focused verification**

- `pnpm exec vitest run apps/api/src/auth/edge-gateway-auth.test.ts apps/api/src/runtime/edge-runtime-composition.test.ts scripts/build-supabase-edge-function.test.ts scripts/verify-supabase-edge-module-graph.test.ts`
- `pnpm run edge:function:build`
- `pnpm run edge:function:graph:verify`
- Boot with `pnpm exec supabase functions serve miraichi-api --env-file .secrets/edge.local.env`
  and observe direct missing/wrong gateway requests return 401 while the process stays healthy.
- `pnpm run typecheck`
- `git diff --check`

**Commit**

- `feat: add fail closed edge api entry`

## Slice 4 — Edge Postgres query and transaction adapter

**Files**

- Add `apps/api/src/persistence/supabase/postgres-js-query-client.ts` and
  `apps/api/src/persistence/supabase/postgres-js-query-client.test.ts`.
- Modify `apps/api/src/persistence/supabase/postgres-query-client.ts` to keep only the shared query
  contract plus the existing Node `pg` factory behind its current export.
- Modify `apps/api/src/persistence/supabase/postgres-query-client.test.ts`.
- Modify `apps/api/src/persistence/create-cloud-persistence-adapter.ts` and
  `apps/api/src/persistence/create-cloud-persistence-adapter.test.ts`.
- Modify `apps/api/src/config/cloud-persistence-config.ts` and
  `apps/api/src/config/cloud-persistence-config.test.ts`.
- Modify `apps/api/src/runtime/edge-runtime-composition.ts` and its test.
- Add `supabase/functions/_shared/postgres-runtime.ts`.
- Add `scripts/supabase-edge-runtime-smoke.ts` and
  `scripts/supabase-edge-runtime-smoke.test.ts`.
- Modify `supabase/functions/miraichi-api/deno.json`, root `package.json`, and `pnpm-lock.yaml`.

**RED observation**

- Adapter tests cannot bind numbered parameters or prove that `transaction()` commits success and
  rolls back exceptions using the `postgres` driver's transaction object.
- The actual local Edge runtime smoke cannot execute a parameterized `select`, an isolated rollback
  marker transaction, and a committed transaction through `SUPABASE_DB_URL`.
- Config tests show Edge would incorrectly require the Node-only CA/base64 path or
  `SUPABASE_DATABASE_URL` instead of the runtime-provided URL.

**Minimal implementation**

- Adapt the version-pinned `postgres` client to the existing `PostgresQueryClient` contract using
  bound values only, `prepare: false`, `max: 1`, bounded idle/connect lifetimes, and explicit
  transaction scope.
- Inject the driver from function-local `_shared` code; keep `pg` and custom CA behavior unchanged
  for owner-local Node tools.
- Make the smoke create/use/remove only a uniquely named temporary verification row or transaction
  marker in local Supabase; it must not touch active match/bet/bankroll rows.

**Focused verification**

- `pnpm exec vitest run apps/api/src/persistence/supabase/postgres-query-client.test.ts apps/api/src/persistence/supabase/postgres-js-query-client.test.ts apps/api/src/persistence/create-cloud-persistence-adapter.test.ts apps/api/src/config/cloud-persistence-config.test.ts scripts/supabase-edge-runtime-smoke.test.ts`
- `pnpm run edge:function:build && pnpm run edge:function:graph:verify`
- `pnpm run edge:runtime:smoke -- --scope postgres` against Supabase CLI local Edge Runtime.
- `pnpm run supabase:local:verify`
- `pnpm run typecheck`
- `git diff --check`

**Commit**

- `feat: connect edge api with transactional postgres`

## Slice 5 — Exact owner auth and cookie flow in Edge Runtime

**Files**

- Modify `apps/api/src/auth/owner-auth.ts` and `apps/api/src/auth/owner-auth.test.ts` only if the
  actual runtime exposes a compatibility defect; do not change scrypt parameters or token format.
- Modify `apps/api/src/runtime/edge-runtime-composition.ts` and its test.
- Modify `scripts/supabase-edge-runtime-smoke.ts` and its test.
- Modify `.env.example` with names/placeholders only; never add values.

**RED observation**

- The real local Edge runtime has not proved Miraichi's exact scrypt `N=16384, r=8, p=1`, HMAC,
  random bytes, constant-time comparison, signed session expiry, and `__Host-` cookie round trip.
- The smoke must show invalid login is generic, valid login returns Secure/HttpOnly/SameSite=Strict
  cookie, that cookie reaches a protected cloud-backed route, logout expires it, and the refresh
  bearer cannot read owner routes.

**Minimal implementation**

- Wire the existing auth/session implementation into Edge composition with runtime-neutral env
  access. Apply only demonstrated Deno compatibility changes and preserve the current password hash
  format, cost, cookie name, TTL, and route policy.

**Focused verification**

- `pnpm exec vitest run apps/api/src/auth/owner-auth.test.ts apps/api/src/auth/owner-auth-boundary.test.ts apps/api/src/runtime/edge-runtime-composition.test.ts scripts/supabase-edge-runtime-smoke.test.ts`
- `pnpm run edge:function:build && pnpm run edge:function:graph:verify`
- `pnpm run edge:runtime:smoke -- --scope auth` against Supabase CLI local Edge Runtime.
- `pnpm run verify:product-boundary`
- `pnpm run typecheck`
- `git diff --check`

**Commit**

- `feat: run owner sessions in supabase edge`

## Slice 6 — Cloudflare thin proxy

**Files**

- Add `apps/cloudflare-gateway/package.json`.
- Add `apps/cloudflare-gateway/src/index.ts` and
  `apps/cloudflare-gateway/src/index.test.ts`.
- Add `apps/cloudflare-gateway/src/config.ts` and
  `apps/cloudflare-gateway/src/config.test.ts`.
- Add `apps/cloudflare-gateway/wrangler.jsonc`.
- Add `apps/cloudflare-gateway/.dev.vars.example`.
- Modify root `package.json`, `pnpm-lock.yaml`, `.gitignore`, and `.env.example`.

**RED observation**

- Proxy tests cannot forward `/api` and `/api/*` to the one exact function origin while delegating
  every non-API request to the Static Assets binding if Worker code receives it.
- Tests require method/query/body streaming, `Cookie`/`Origin` preservation, hop-by-hop header
  removal, overwrite of gateway and `x-region`, `redirect: manual`, one upstream subrequest,
  repeated `Set-Cookie` preservation, `Cache-Control: no-store`, and sanitized 502/504 failures.
- Configuration tests require an HTTPS function URL ending in `/functions/v1/miraichi-api`, an
  exact HTTPS public origin, `eu-central-1` in staging, and no database/provider/owner secrets.

**Minimal implementation**

- Add a Worker `fetch` handler that proxies only the API path, injects only the gateway secret and
  fixed region, streams in both directions, and delegates static/non-API requests to Static Assets.
- Keep the gateway token as the sole Cloudflare secret. Treat function URL, region, and public
  origin as non-secret deployment vars.

**Focused verification**

- `pnpm exec vitest run apps/cloudflare-gateway/src/config.test.ts apps/cloudflare-gateway/src/index.test.ts`
- `pnpm run typecheck`
- `pnpm run verify:product-boundary`
- `git diff --check`

**Commit**

- `feat: proxy owner api through cloudflare`

## Slice 7 — Cloudflare Static Assets and deploy artifact gate

**Files**

- Modify `apps/cloudflare-gateway/wrangler.jsonc`.
- Add `scripts/cloudflare-owner-hosting-verify.ts` and
  `scripts/cloudflare-owner-hosting-verify.test.ts`.
- Modify `scripts/hosted-deployment-boundary.test.ts`.
- Modify `scripts/owner-hosted-deployment-readiness.test.ts`.
- Modify `scripts/staging-smoke-check.ts` and `scripts/staging-smoke-check.test.ts`.
- Modify root `package.json` and `docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md`.

**RED observation**

- Static configuration does not yet bind `apps/web/dist`, enable SPA fallback, or run Worker code
  first only for `/api` and `/api/*`.
- The old deployment-boundary/readiness tests still describe Koyeb as active.
- The artifact verifier cannot prove the build has 63 files at the current baseline, every file is
  below 25 MiB, total count is below 20,000, API URLs stay same-origin, and the Wrangler upload can
  be prepared without deployment.

**Minimal implementation**

- Configure Static Assets with `not_found_handling = single-page-application` and exact
  `run_worker_first` patterns.
- Add build inventory plus `wrangler deploy --dry-run --outdir ...` verification to an ignored
  temporary directory. Update staging smoke to require same-origin API health rather than a
  separately exposed API base URL.
- Update the runbook with exact secret names and owner-run commands, while retaining explicit
  no-deploy/no-push status until staging is authorized.

**Focused verification**

- `pnpm exec vitest run scripts/cloudflare-owner-hosting-verify.test.ts scripts/hosted-deployment-boundary.test.ts scripts/owner-hosted-deployment-readiness.test.ts scripts/staging-smoke-check.test.ts`
- `pnpm run build:web-static`
- `pnpm run cloudflare:artifact:verify`
- `pnpm run pwa:verify`
- `git diff --check`

**Commit**

- `feat: package pwa as cloudflare static assets`

## Slice 8 — Vault-backed hourly refresh scheduler

**Files**

- Add `apps/api/src/persistence/supabase/sql/edge-hourly-live-refresh.sql` and
  `apps/api/src/persistence/supabase/sql/edge-hourly-live-refresh.test.ts`.
- Add `supabase/migrations/20260903120000_edge_hourly_live_refresh.sql` with byte-identical SQL.
- Modify `scripts/hourly-live-refresh-workflow.ts` and
  `scripts/hourly-live-refresh-workflow.test.ts`.
- Modify `.github/workflows/hourly-live-refresh.yml` only after local SQL verification; retain
  manual rollback execution and remove its hourly trigger only when staging cron smoke succeeds.
- Modify `docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md`.

**RED observation**

- SQL tests cannot find a least-privilege scheduler function that reads the exact Vault secret
  names at execution time, sends both gateway and refresh credentials, adds `x-region:
  eu-central-1`, uses the one hourly refresh route, and prevents scheduling while secrets are
  missing.
- Tests require idempotent configure/unschedule behavior, no literal URL/token values, locked-down
  execute privileges, and no full-season/data-hydration call.
- The existing GitHub workflow is still the only hourly scheduler.

**Minimal implementation**

- Enable/use `pg_cron`, `pg_net`, and Vault through a migration that creates locked-down invoke,
  configure, and unschedule functions. The migration does not contain secrets and does not start a
  job before the owner stores all three Vault values and explicitly calls configure.
- Schedule `17 * * * *` and post only to `/api/v1/live/refresh?reason=hourly`. Preserve a manual
  GitHub rollback path until the Frankfurt staging cron smoke is recorded; do not allow two hourly
  schedules to remain active after that gate.

**Focused verification**

- `pnpm exec vitest run apps/api/src/persistence/supabase/sql/edge-hourly-live-refresh.test.ts scripts/hourly-live-refresh-workflow.test.ts`
- `pnpm exec supabase db reset --local`
- `pnpm exec supabase db lint --local --schema miraichi_app --level warning --fail-on error`
- `pnpm exec supabase db advisors --local --type security --fail-on error`
- Local SQL smoke with disposable Vault values proves missing-secret rejection, one job, one
  sanitized pg_net request, and idempotent unschedule; remove disposable values afterwards.
- `pnpm run verify:product-boundary`
- `git diff --check`

**Commit**

- `feat: schedule edge live refresh from supabase`

## Slice 9 — Cross-runtime integration

**Files**

- Add `tests/integration/supabase-edge-owner-flow.test.ts`.
- Add `tests/integration/cloudflare-edge-owner-flow.test.ts`.
- Modify `tests/integration/hosted-owner-live-flow.test.ts` only for missing cross-runtime glue.
- Modify root `package.json` to include the new integration chain.
- Modify `scripts/supabase-edge-runtime-smoke.ts` and
  `scripts/cloudflare-owner-hosting-verify.ts` only for failures demonstrated here.

**RED observation**

- No integration chain proves Cloudflare `/api` proxy -> gateway -> owner login/session ->
  cloud-backed matches/bankroll/bet route -> visible refresh -> terminal projection -> logout.
- No integration test proves direct Edge denial, provider-locator redaction, unavailable hosted
  match detail without filesystem mutation, refresh-token route isolation, transaction rollback,
  cookie preservation, and single upstream subrequest together.

**Minimal implementation**

- Add integration fixtures around the real Web router, Edge composition, Postgres adapter contract,
  and Cloudflare proxy. Change production code only where a failing integration exposes missing
  glue; do not add a second API or public database path.

**Focused verification**

- `pnpm exec vitest run tests/integration/hosted-owner-live-flow.test.ts tests/integration/supabase-edge-owner-flow.test.ts tests/integration/cloudflare-edge-owner-flow.test.ts`
- `pnpm run edge:function:build && pnpm run edge:function:graph:verify`
- `pnpm run edge:runtime:smoke -- --scope all`
- `pnpm run cloudflare:artifact:verify`
- `git diff --check`

**Commit**

- `test: prove cloudflare to edge owner flow`

## Slice 10 — Local release closeout and staging handoff

**Files**

- Modify `PROJECT_PLAN.md` with actual slice commit hashes and gate evidence.
- Modify `docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md` so every command matches the
  implemented scripts and separates local, Frankfurt staging, and future Tokyo production.
- Modify `docs/decisions/ADR-0052-supabase-edge-cloudflare-owner-hosting.md` only if an observed
  runtime fact forced a design change; record the change instead of silently diverging.
- Modify `docs/README.md` only if final navigation changed.

**RED observation**

- Closeout is not allowed while any required verification fails or the runbook describes commands
  that do not exist.
- Local evidence cannot satisfy Frankfurt deployment, authenticated hosted smoke, cron delivery,
  rollback, owner feedback, or production approval.

**Minimal implementation**

- Correct only defects exposed by the gates, record exact evidence, and recommend
  `phase:staging Supabase Edge Function and Cloudflare Worker owner hosting` as the earliest next
  phase if every local gate passes.
- Leave the phase blocked at staging owner actions: secret entry, explicit push/deploy approval,
  function/Worker deployment, Vault configuration, remote migration, and hosted smoke. Do not
  execute those actions in this slice.

**Verification**

- `pnpm run verify:product-boundary`
- `pnpm run verify:local`
- `pnpm run test:integration`
- `pnpm run verify:release`
- `pnpm run verify:staging`
- `pnpm run edge:runtime:smoke -- --scope all`
- `pnpm run cloudflare:artifact:verify`
- `git diff --check`

**Commit**

- `docs: close local edge owner hosting phase`

## Staging handoff gate after Slice 10

The code phase ends locally. The owner must then explicitly authorize the push/deploy workflow and
enter secrets directly into Supabase, Vault, and Cloudflare. Frankfurt staging still must prove:

1. Function deploy/boot and direct-URL gateway denial.
2. Cloudflare static/PWA delivery and same-origin authenticated cookie flow.
3. Real parameterized read plus transaction rollback/commit against the retained staging DB.
4. Visible/manual live refresh and one hourly pg_cron -> pg_net delivery with sanitized evidence.
5. Rollback to the previous Cloudflare/Function version, followed by owner feedback approval.

Only after those facts exist may a separate phase recommend Tokyo creation or production
promotion. Frankfurt deletion is never implicit and remains forbidden without explicit approval.
