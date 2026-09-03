# Supabase Edge Function + Cloudflare Worker Owner Hosting Design

* **Status**: Approved design; implementation plan pending
* **Date**: 2026-09-03
* **Decision**: `docs/decisions/ADR-0052-supabase-edge-cloudflare-owner-hosting.md`
* **Lifecycle**: `phase:plan` complete; `phase:implementation-plan` is next

## Outcome

Miraichi will expose one free `*.workers.dev` origin. Cloudflare serves the static PWA and proxies
only `/api` traffic to one Supabase Edge Function. The function owns Miraichi authentication,
routing, cloud persistence, and the bounded SportScore widget live refresh. Supabase Postgres remains
the source of hosted state.

```text
Browser
  -> Cloudflare Worker (public origin)
       -> Static Assets for non-/api requests
       -> exact one-hop proxy for /api and /api/*
            + gateway token (secret)
            + forced Edge region (non-secret)
            -> Supabase Edge Function: miraichi-api
                 -> owner session boundary
                 -> one runtime-neutral API router
                 -> postgres via SUPABASE_DB_URL
                 -> SportScore /api/widget/* only for live refresh

Supabase pg_cron
  -> pg_net
       -> Vault URL + gateway token + refresh-only token
            -> same Edge live-refresh route
```

## Request Flow

1. Static requests are resolved by Cloudflare Static Assets without invoking Worker code whenever a
   file exists. SPA navigation falls back to `index.html`.
2. Exact `/api` and `/api/*` requests invoke the Worker. The Worker constructs, rather than accepts,
   the Supabase function base URL and overwrites gateway/region headers.
3. The Edge entrypoint rejects the request unless the gateway token matches in constant time.
4. The router validates the public origin where present, resolves the route, and then applies either
   owner-session auth or the exact hourly refresh-token exception.
5. Route code receives Web `Request` and returns Web `Response`; it does not know whether Node or
   Deno hosts it.
6. The Worker streams the response and preserves distinct `Set-Cookie` values. `/api` is never cached.

## Runtime Separation

The current Node entrypoint, static server, filesystem serving store, local detail store, and local
detail queue stay available for local workflows but outside the Edge dependency graph. Shared API
logic accepts injected config, repositories, clock, fetch, and cryptography where testing requires
it. Environment reading happens only in runtime composition roots.

The Edge composition root uses:

- `Deno.env` for Miraichi secrets/config and the built-in `SUPABASE_DB_URL`;
- the cloud match snapshot repository only;
- an Edge-compatible `PostgresQueryClient` implementation over `postgres`;
- the current provider-neutral live coordinator and widget client;
- explicit unavailable behavior for the still-pending filesystem-backed lazy detail path.

No fallback to generated local match data is allowed in hosted Edge mode. A missing/unavailable
database is a 503, not a silent empty or ephemeral store.

## Security Properties

- Browser assets contain no Supabase URL, database password, gateway token, refresh token, password
  hash, or session signing secret.
- Cloudflare contains only the Edge function target, region, public origin, and gateway secret. It
  cannot query Postgres.
- The Edge Function contains owner auth/session secrets, refresh-only token, and gateway token. Its
  automatic database URL never leaves Supabase.
- Gateway auth runs before body parsing and expensive crypto/database/provider work.
- The browser can call login/session through its same origin. Cloudflare adding the gateway token
  does not make any owner-data route public because the Edge router still requires the signed owner
  cookie.
- `__Host-` cookie attributes remain `Path=/; Secure; HttpOnly; SameSite=Strict` with no `Domain`.
- API responses are `no-store`; provider locators and secret/internal headers are not reflected.
- Request bodies have explicit route-appropriate byte ceilings in the runtime-neutral reader; the
  100 MB Cloudflare account ceiling is not treated as an application-safe limit.

## Database Contract

Keep the existing `CloudPersistenceAdapter` and `PostgresQueryClient` behavioral contracts. Replace
only the runtime implementation:

- parameter values remain separate from SQL text;
- `prepare: false` supports a transaction-pool-compatible connection;
- `sql.begin` supplies one transaction-scoped client;
- nested use reuses that scoped transaction, matching current semantics;
- connection count and lifetime are bounded for isolates;
- raw SQL, parameters, URLs, and database errors containing sensitive detail are never logged.

The exact driver and automatic URL remain provisional until tested in Supabase's local Edge Runtime.
Data API remains disabled.

## Crypto Contract

The stored `scrypt-v1` format and parameters do not change. The compatibility slice must execute a
known hash success, wrong-password failure, session create/verify/expiry, HMAC, random byte, Buffer
base64url, and timing-safe comparison inside `supabase functions serve`. It records only pass/fail and
bounded timings. Any incompatibility is a blocker, not permission to downgrade password hashing.

## Region Contract

Staging calls are pinned to `eu-central-1`; production calls will be pinned to `ap-northeast-1` only
after a Tokyo project exists. Both Cloudflare and cron own this header. User input cannot select an
execution region. Smoke evidence records `x-sb-edge-region`.

## Cron And Vault Contract

The hourly job has one stable name and schedule (`17 * * * *`). Its SQL command contains only Vault
secret names. Runtime-decrypted values populate:

- Edge Function URL;
- `X-Miraichi-Gateway-Token`;
- `Authorization: Bearer <refresh-only token>`.

The job calls no owner-data route and no provider directly. `cron.job_run_details` plus `pg_net`
request status provide operational evidence without secret values. Retry remains governed by the
existing durable live-refresh state; cron itself must not create a request storm.

## Rollout Sequence

1. Prove runtime-neutral route behavior in Node tests.
2. Prove exact crypto and Postgres commit/rollback behavior in local Supabase Edge Runtime.
3. Complete the Edge router, gateway, Cloudflare proxy, static asset, and cron contracts through
   separate TDD slices and commits.
4. Pass product-boundary, local, integration, release, and staging build gates.
5. Ask the owner to configure the one new gateway token and deploy to retained Frankfurt staging.
6. Smoke direct-URL rejection, same-origin login/cookie/logout, match and owner flows, live refresh,
   cron, region, and rollback. No local result counts as this evidence.
7. Stop at staging/owner feedback. Do not create Tokyo, deploy production, delete Frankfurt, or push
   without the corresponding explicit owner action.

## Acceptance Gates

- Direct Edge calls without the gateway token cannot reach health, auth, data, provider, or database
  behavior.
- Cloudflare same-origin login sets and subsequently forwards the `__Host-` cookie; logout expires it.
- Every existing owner route works through Web `Request`/`Response` against cloud persistence.
- Successful transaction commits and injected mid-transaction failure rolls back.
- Edge login remains inside platform CPU/memory limits with the exact stored scrypt parameters.
- Static assets serve with SPA fallback; only `/api` paths invoke proxy code.
- No API response is cached, and no secret/internal header appears in browser responses or logs.
- Hourly cron uses Vault, the exact refresh-only route, the shared durable lease, and Frankfurt region.
- No SportScore `/api/v1`, full-season hydration, historical season, or lazy-detail implementation is
  introduced.
