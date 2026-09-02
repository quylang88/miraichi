# Owner-Hosted API And Live Overlay Implementation Plan

> Owner approved on 2026-09-02. Execute in order. Observe RED before production behavior, reach
> focused GREEN, and create one local commit before starting the next slice. Do not push or deploy.

## Slice 1 — Hosted single-origin runtime

**Files**
- Modify `apps/api/package.json`, root `package.json`, and API server composition.
- Add `apps/api/src/hosted-static-server.ts` and focused tests.
- Update `.env.example` and deployment verification as required.

**RED**
- Hosted mode fails when the built PWA is missing.
- API routes take precedence; static assets and SPA fallback are served without path traversal.
- Production has a non-watch start command and does not require a committed serving manifest.
- CORS never emits `*`; only one exact configured local origin is accepted.

**Implementation**
- Compose API routing and static PWA serving in one Node process/port.
- Use cloud snapshot fallback and same-origin URLs in hosted output.

**Verify**
- Focused API hosted-server tests.
- `pnpm run build:web-static` and `pnpm run typecheck`.
- Commit locally.

## Slice 2 — Owner-only session boundary

**Files**
- Add API auth config/session/routes/middleware and tests.
- Add password-hash utility script and tests.
- Add web auth bootstrap/login/logout, localized copy, styles, and tests.

**RED**
- Non-local startup fails without password hash/session secret.
- Invalid login is generic; valid login sets Secure/HttpOnly/SameSite=Strict cookie.
- Owner routes reject missing/invalid sessions; logout clears the cookie.
- Service refresh token cannot access any owner data route.
- App shell loads only after authenticated session bootstrap.

**Implementation**
- Scrypt password verification, HMAC session token, no registration.
- Exact route policy and same-origin cookie flow.

**Verify**
- Focused auth/API/web tests, product boundary, typecheck.
- Commit locally.

## Slice 3 — Durable live overlay and refresh lease

**Files**
- Add shared provider-neutral live contracts and tests.
- Extend cloud persistence interface, memory adapter, Supabase adapter, and tests.
- Add a Supabase migration and mirror schema SQL.

**RED**
- Last-good live snapshot round-trips in memory and Postgres mappings.
- Only one unexpired per-owner refresh lease may be acquired.
- Completing/failing a lease records sanitized refresh state without erasing last-good data.

**Implementation**
- Store normalized overlay JSON and durable refresh state/lease in dedicated tables.

**Verify**
- Focused shared/persistence/migration tests and typecheck.
- Commit locally.

## Slice 4 — SportScore widget live refresh

**Files**
- Add exact-origin widget client, adapter, coordinator, and focused tests under `apps/api/src/live/`.
- Add live read/refresh API routes and tests.

**RED**
- Client can call only documented `/api/widget/matches/` and tracked `/api/widget/match/`; all
  `/api/v1` and arbitrary origins are structurally impossible.
- Only uniquely resolved canonical current matches publish; ambiguous/unmapped records are dropped.
- Visible/manual/hourly requests share TTL and lease.
- Missing tracked live records require bounded terminal checks; disappearance never implies FT.
- Provider failure preserves last-good overlay.

**Implementation**
- Normalize score/status/minute only and expose sanitized provider-neutral live response.

**Verify**
- Focused live client/adapter/coordinator/route tests, product boundary, typecheck.
- Commit locally.

## Slice 5 — Hourly wake-up operation

**Files**
- Add `.github/workflows/hourly-live-refresh.yml`.
- Add workflow/static verification script and tests.
- Add exact deployment/secret instructions under `docs/operations/`.

**RED**
- Workflow runs hourly and calls only the live refresh route with the refresh service token.
- Missing URL/token fails without printing secrets.
- The operation has no SportScore `/api/v1`, no local data mutation, and no deploy step.

**Implementation**
- Best-effort GitHub Actions wake-up with bounded curl timeout/retry.

**Verify**
- Focused workflow verification and lifecycle checks.
- Commit locally.

## Slice 6 — Visible polling, pull-down, and live UI

**Files**
- Add web live service, lifecycle controller, pull-down controller, and focused tests.
- Modify Matches screen/shell/locales/styles and relevant tests.

**RED**
- Authenticated boot and visible/focus/pageshow/online refresh immediately.
- Exactly one five-minute timer exists while visible; hidden/pagehide stops it.
- Pull-down at scroll top crosses the threshold once and has no fallback Refresh button.
- Live score/status/minute and partial/stale/unavailable state render factually.

**Implementation**
- Wire API-mediated refresh/read and render a separate live section without changing terminal-only
  season contracts.

**Verify**
- Focused web tests, full web tests, PWA verification, typecheck.
- Commit locally.

## Slice 7 — Static attribution compliance

**Files**
- Modify server-rendered HTML and remove dynamic attribution duplicates/tests.
- Add static artifact attribution verification.

**RED**
- Built `index.html` contains exactly one visible SportScore link with exact href, title, and
  `rel="dofollow"` before JavaScript executes.
- Matches/detail do not inject duplicate links.

**Implementation**
- Add the static footer and retain provider-neutral runtime data.

**Verify**
- Focused source/build tests, static build, product boundary, typecheck.
- Commit locally.

## Slice 8 — Integration and local release closeout

**Files**
- Add/update `tests/integration/` hosted owner/live flow.
- Update `PROJECT_PLAN.md` with commit/gate evidence and phase recommendation.

**RED**
- Integration initially lacks login -> refresh -> live read -> terminal projection -> logout proof.

**Implementation**
- Add only missing cross-module glue found by the integration test.

**Verify**
- Focused integration.
- `pnpm run verify:product-boundary`.
- `pnpm run verify:local`.
- `pnpm run test:integration`.
- `pnpm run verify:release`.
- Commit locally; do not push, deploy, or promote.
