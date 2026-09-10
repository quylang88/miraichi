# Project Plan

## Current State

- **Status**: User-triggered rich match detail is implemented and verified on Frankfurt staging.
  The complete hosted browser/scheduler gate passed after rollback restoration at
  `2026-09-10T06:11:26.413Z`. The candidate is ready for the requested owner feedback.
- **Completed boundary**: Product Reset — owner-only factual match data, manual bets/odds, and bankroll management.
- **Superseded phase**: The API-Football staging path is cancelled. Its Free plan did not provide current-season entitlement, so no further provider request or production promotion is approved.
- **Completed phase**: `phase:plan SportScore Public API Validation And Source Boundary` — owner accepted SportScore, visible attribution, optional local key handling, and complete API-Football implementation removal on 2026-08-26.
- **Completed phase**: `phase:implementation-plan SportScore Public API Validation And Source Boundary` — ADR-0048, the design spec, and the exact TDD slice plan are written.
- **Superseded operational path**: SportScore date hydration, local scheduling, worker injection, and all new `/api/v1` requests are retired because the free terms cover only `/api/widget/*` and the date scan is not viable.
- **Completed phase**: `phase:integration-test Season-oriented provider-neutral hydration and coverage refactoring` — provider-neutral current-before-past planning, OpenFootball season-file ingestion, isolated checkpoints, and the complete local release gate passed on 2026-08-29.
- **Completed phase**: `phase:code-slice FotMob unofficial current-season hydration` — the owner accepted ADR-0049 risk, all 45 executable current editions were checkpointed, and the final local release gate passed on 2026-08-31.
- **Completed phase**: `phase:integration-test FotMob daily terminal results and current-edition revalidation` — all eight TDD slices and the local release gate passed on 2026-08-31.
- **Completed phase**: `phase:maintenance FotMob owner-local current data operations` — guarded current hydration, 24-hour current revalidation, and terminal-result once/watch operation remain available, but no provider operation is part of the active product phase.
- **Completed phase**: `phase:integration-test Single-bankroll usable owner flow` — the single visible bankroll, internal compatibility account, reviewed bankroll/bet/psychology remediations, sequential TDD slices, and complete local release gate all passed on 2026-09-01.
- **Completed phase**: `phase:integration-test Owner-hosted API and visibility-driven live overlay` — all eight sequential TDD slices and the complete local release gate passed on 2026-09-02. No deployment, push, or production promotion occurred.
- **Superseded hosting path**: Koyeb staging is blocked for this owner. Koyeb still documents a
  Free Instance for eligible organizations, but its 2026 transition requires new users to provide a
  payment method and subscribe to a paid plan. The owner rejected that dependency; no Koyeb setup,
  secret entry, deployment, or smoke is still planned.
- **Completed phase**: `phase:plan Supabase Edge Function and Cloudflare Worker owner hosting` —
  the owner approved the replacement topology, ADR-0052 and the runtime/security design are
  recorded, and the replacement staging runbook identifies the unproven runtime gates.
- **Completed phase**: `phase:implementation-plan Supabase Edge Function and Cloudflare Worker
  owner hosting` — ten sequential TDD slices now name exact files, RED observations, minimal
  implementation, focused verification, and local commit boundaries.
- **Completed phase**: `phase:integration-test Supabase Edge Function and Cloudflare Worker owner
  hosting` — all ten local TDD slices, the complete local/release/staging command gates, actual
  Supabase Edge runtime smoke, and Cloudflare artifact verification passed on 2026-09-07.
- **Completed phase**: `phase:staging Supabase Edge Function and Cloudflare Worker owner hosting` —
  the reviewed branch is pushed; Frankfurt migration, Edge Function, Worker, Vault cron, complete
  hosted owner smoke, full staging gate, and rollback drill passed on 2026-09-08.
- **Completed phase**: `phase:staging Hosted automatic provider refresh and Matches LIVE quality-up`.
  The owner-authorized implementation, forward migrations, Frankfurt redeployment, committed hosted
  E2E, and rollback/restore exit gates passed. Git delivery uses the existing approved branch.
- **Completed phase**: `phase:staging User-triggered hosted match detail`.
  The owner explicitly reopened lazy detail and authorized implementation through hosted E2E.
  Research and exact TDD slices are recorded in ADR-0053 and
  `docs/superpowers/plans/2026-09-09-user-triggered-match-detail.md`. Refresh only the selected match on an explicit
  detail action; no detail cron, prefetch, polling, pending retry timer or automatic page-focus refresh.
  The previous staging evidence is retained; moving phases is not production approval.
- **Active phase**: `phase:owner-feedback User-triggered hosted match detail`.
- **Match-detail local exit gate (2026-09-10)**: reviewed slices and integration correction through
  `98cee02` pass `verify:staging` (157 files / 796 unit tests, complete integration/endpoint/PWA and
  static build), actual detail PostgreSQL smoke, actual Edge runtime auth/Postgres smoke, module
  graph and 67-file Cloudflare artifact gate. The old Frankfurt candidate fails the committed new
  detail E2E because its Information action sends no POST refresh. New-candidate hosted E2E,
  rollback/restore and the combined gate now pass; see the closeout below.
- **Approved implementation plan**: `docs/superpowers/plans/2026-09-09-user-triggered-match-detail.md`.
  Previous DB-first refresh design: `docs/superpowers/specs/2026-09-09-hosted-provider-refresh-live-design.md`.
- **Historical-season state**: **PENDING by owner decision on 2026-08-31**. Past-1 and past-2 execution must not run until the owner explicitly reopens `phase:plan` for exact provider-season verification.
- **Lazy match-detail state**: **DELIVERED TO STAGING on 2026-09-10** through research, reviewed
  TDD slices and Frankfurt E2E, retaining canonical IDs and nullable factual fields.
  Existing source approvals apply; no paid source, bypass, historical hydration or production action.
- **Promotion state**: Frankfurt retains 11,163 matches across 45 competitions, 35 snapshots and
  two detail caches (independent read at `2026-09-10T06:12:07.605Z`). Edge Function version 14
  is ACTIVE; Cloudflare Worker `e735457e-245f-474f-8df3-965be8eb6041` serves 100% of traffic.
  The three refresh jobs and four Vault names are restored. Owner acceptance, Tokyo project
  creation, and production promotion remain unapproved.
- **Current lifecycle source of truth**: this file.

## User-triggered hosted match detail — 2026-09-10 closeout

- **Delivered**: per-match cache-only GET and owner-triggered POST refresh, durable leases and
  publication fencing, 60-second per-match floor, ETag/304, last-good preservation, request bounds,
  and a provider circuit shared with hosted scheduled operations. No detail cron, prefetch,
  polling, pending retry timer or automatic focus refresh.
- **Information UI**: factual events, confirmed lineups/coaches, stadium/referee/attendance,
  period/team/player statistics and a shot map/list. EN/VI labels match; missing values remain
  absent/null, and unverified physical units are hidden. Canonical match/bankroll data is not
  overwritten by detail observations.
- **Real hosted acceptance**: completed Manchester United/Ipswich returned 3 statistic periods,
  32 players and 43 shots. The pre-researched upcoming AFC Bournemouth/Brentford sample refreshed
  successfully. Browser assertions cover selected-ID request counts, no card/Bets request,
  manual cooldown, error/late-response/202 fixtures, mobile layout, owner login/logout/replay,
  and credential/locator/internal-header redaction. Fixtures are identified separately from
  real provider results. No owner bet, draft, bankroll or ledger data was created by these E2Es.
- **Coverage limit**: two acceptance samples do not prove uniform detail availability across 45
  competitions. Santos/Cruzeiro was rejected for conflicting canonical/provider names and kickoff;
  no detail was published, and this observation does not establish which side is correct.
  Upcoming fixture expiry is a hard failure; replace it with a newly verified current-season
  sample when necessary. Never skip the gate or loosen identity matching to make it pass.
- **Hosted exit gate**: `verify:staging:hosted` passed at `2026-09-10T06:11:26.413Z` after restoration.
  Exact four Vault names and three cron jobs were verified; controlled current/terminal/live
  deliveries returned 2xx and valid `fresh` no-ops. Thirteen forward migrations are applied.
  A subsequent independent read confirmed zero drafts, bets, bankroll accounts and ledger entries.
- **Rollback**: zero scheduler jobs during the drill; baseline Edge/Worker passed the previous
  owner/LIVE suite against the additive schema. The new detail suite exposed the expected missing
  POST in the old UI. Restored detail Edge/Worker passed browser E2E; three jobs, four Vault names,
  match snapshots and detail caches were retained. Full evidence and bundle hashes are in the
  hosting runbook. Every behavior slice was reviewed and committed locally before the next slice.
- **Next**: requested `phase:owner-feedback`. The owner should exercise Information and report
  acceptance or concrete corrections. No additional decision is needed for completed staging
  work; production/Tokyo and historical hydration remain separate, unapproved actions.

## Hosted automatic provider refresh and Matches LIVE — 2026-09-09 closeout

- **Delivered**: DB-first current/terminal refresh, shared durable lease and fenced atomic delta
  publication, TTL/ETag checkpoints, bounded requests/timeouts/backoff, and five-minute background
  widget live refresh. Current cap is nine, with an Edge default of three. Terminal requests remain
  due-ledger driven; the 0–2 minute objective is best effort, not an upstream availability promise.
- **Owner UI**: one Matches LIVE toggle replaces the date list, uses last-good state, renders only
  live/halftime/suspended score/minute rows, shows a visible empty state, and restores the previous
  date/search/filters. EN/VI parity and crawler-visible SportScore attribution are retained.
- **Hosted gate**: `pnpm run verify:staging:hosted` passed after restoration at
  `2026-09-09T04:38:29.867Z` on the exact Cloudflare origin. Real Chromium login/session/four-tab/
  LIVE/logout/replay/redaction checks and explicit deterministic live/empty fixtures passed.
  Controlled current/terminal/live deliveries returned 2xx with valid `fresh` no-ops; the earlier
  complete gate at `01:23:40.919Z` also observed terminal `refreshed` with checkpoint progress.
- **Local gate**: the final `pnpm run verify:staging` passed 150 unit files / 733 tests, lint,
  TypeScript, product/lifecycle/architecture/type-safety audits, all integration suites, endpoint
  E2E, PWA checks and the static build. Actual local PostgreSQL fencing/rollback/cleanup and Edge
  runtime auth/persistence smokes also passed during this implementation.
- **Remote persistence**: eleven forward migrations through `20260909150000` are applied. The
  canonical registry has 45 current-edition checkpoints. No historical hydration or lazy detail
  was enabled. E2E creates no owner bankroll/bet rows; finally logout and browser cleanup passed.
- **Rollback evidence**: scheduler removal produced zero jobs while retaining Vault and data.
  Prior Worker `1c71033f-f97f-42b9-9884-1862d64ad870` and the exact `f3113ed` Edge bundle were
  deployed; browser checks exposed the expected old LIVE and session-replay limitations.
  Current Worker/Edge restoration passed browser E2E, then reconfiguration restored three jobs.
  Counts remained 11,163 matches / 17 snapshots. Migrations and owner data were preserved.
- **Saved credentials**: both committed hosted commands reuse `STAGING_URL` and
  `MIRAICHI_OWNER_PASSWORD` from the gitignored root `.env`; repeated entry is unnecessary.
  Credential values are excluded from deployment artifacts, reports and Git.
- **Owner decision required**: accept or reject this new staging candidate. The earliest safe
  next phase is the explicitly requested `phase:owner-feedback`; production is a separate decision.
- **Evidence/runbook**: `docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md` and
  `docs/superpowers/plans/2026-09-09-hosted-provider-refresh-live.md`.

## Historical Owner-Hosted API And Visibility-Driven Live Overlay — 2026-09-02

The application/auth/live implementation remains current, but ADR-0052 supersedes its Koyeb and
GitHub Actions hosting topology. The Koyeb instructions below are historical evidence, not an active
deployment path.

- **Owner decision**: use Koyeb's generated HTTPS domain for the MVP; Cloudflare is not required.
- **Persistence**: deploy no generated local snapshot. Apply migrations and sync canonical/current
  data to Supabase before hosted smoke testing.
- **Security**: add one-owner password login with signed secure HTTP-only sessions, no registration,
  same-origin serving, exact local CORS only, and a refresh-only service token for hourly wake-up.
- **Live boundary**: call only SportScore `/api/widget/*`, resolve only unique known canonical
  current matches, publish score/status/minute only, and preserve last-good state on gaps/failure.
- **Refresh boundary**: five minutes while visible, pull-down through the same cooldown, one-hour
  GitHub Actions wake-up while closed, and one shared durable lease across all callers.
- **Attribution**: one server-rendered crawler-visible exact SportScore link; no dynamic duplicates.
- **Deferred work**: historical-season hydration and user-visible lazy full match detail remain
  `PENDING`. No SportScore date hydration or `/api/v1` request is reintroduced.
- **Decision**: `docs/decisions/ADR-0051-owner-hosted-api-and-live-overlay.md`.
- **Design**: `docs/superpowers/specs/2026-09-02-owner-hosted-api-live-overlay-design.md`.
- **Implementation plan**: `docs/superpowers/plans/2026-09-02-owner-hosted-api-live-overlay.md`.

### TDD and commit evidence

- Planning gate: `3283027 docs: approve owner hosted live flow`.
- Slice 1, hosted single-origin runtime: `cd56e94 feat: add hosted single origin runtime`.
- Slice 2, owner-only session boundary: `4494a49 feat: protect hosted app with owner session`.
- Slice 3, durable provider-neutral live state and lease: `97dfcc5 feat: persist provider neutral live overlay`.
- Slice 4, widget-only live client/adapter/coordinator/routes: `dc8f5d1 feat: add widget-only live refresh flow`.
- Slice 5, hourly wake-up and deployment runbook: `053a555 feat: add hourly hosted live operation`.
- Slice 6, visible polling, pull-down, and live UI: `ae6e66e feat: add visibility-driven live match UI`.
- Slice 7, exact static attribution: `0185394 fix: make SportScore attribution static`.
- Slice 8 closes the cross-module terminal projection and release evidence in the local closeout
  commit after all release gates pass.

### Local closeout evidence

- The hosted integration chain proves password login, secure owner session enforcement, visible
  live refresh, bounded terminal recheck after a tracked match disappears, confirmed FT score
  projection into `GET /api/v1/matches`, provider-locator redaction, and logout.
- A confirmed terminal overlay is applied only when canonical match ID, competition ID, kickoff,
  and both canonical team IDs match exactly, and only when its evidence is not older than the
  canonical record. Live, halftime, suspended, mismatched, and stale overlays cannot mutate the
  terminal match projection.
- `pnpm run verify:release` passed on 2026-09-02: product-boundary and lifecycle verification,
  642 unit tests across 124 files, lint, TypeScript, architecture and type-safety audits, 12 focused
  SportScore contract tests, 52 season integration tests, 35 FotMob terminal integration tests,
  the hosted owner/live integration, endpoint E2E, and PWA verification.
- The SportScore contract verifier used only the pinned offline widget contract and reported
  `networkUsed: false`. No SportScore `/api/v1` request, provider data request, active-data deletion,
  staging deployment, production schema application, push, or production promotion occurred.
- The operational deployment sequence is documented in
  `docs/operations/KOYEB-SUPABASE-OWNER-HOSTING.md`. Koyeb's generated HTTPS domain is sufficient;
  Cloudflare remains unnecessary for this MVP.

### Phase transition recommendation

- The implementation and local integration phase is complete. The earliest safe next phase is
  `phase:staging Owner-hosted API and visibility-driven live overlay`.
- Staging is blocked until the owner creates/configures the external Supabase and Koyeb projects,
  stores secrets in their dashboards, links a GitHub repository containing these local commits,
  and explicitly authorizes the required push/deployment. Secrets must not be pasted into chat or
  committed.
- The staging exit gate will require `pnpm run verify:staging`, a real Koyeb deployment, migration
  and current-serving-snapshot sync to Supabase, authenticated owner-flow smoke, hourly refresh
  smoke, and fresh recorded evidence. Local verification is not staging approval.
- Historical-season hydration and lazy full match detail remain explicitly `PENDING` and are not
  prerequisites for this staging phase.

### Staging preflight maintenance — 2026-09-02

- The first owner-run cloud snapshot sync reached the Supabase session pooler but failed before
  opening its transaction with `self-signed certificate in certificate chain`; no match row was
  written by that attempt.
- RED tests reproduced the configuration hole: URI `sslmode` parameters could override the
  Node/Postgres SSL object, while the runtime had no project CA input.
- The client now requires `SUPABASE_DATABASE_CA_BASE64` for every remote Supabase connection,
  decodes the project PEM CA, verifies certificate and hostname, and strips conflicting URI SSL
  parameters before constructing the pool. It does not use `rejectUnauthorized: false`.
- Focused config/client/sync tests passed 14 tests across four files; `pnpm run verify:local` passed
  645 tests across 124 files plus all lifecycle, product-boundary, lint, TypeScript, architecture,
  and type-safety gates. A new owner upload attempt still requires the downloaded project CA and
  is staging evidence, not local approval.
- Pre-upload review then found the snapshot adapter issued one remote INSERT per match. A second
  RED -> GREEN maintenance slice replaced 10,899 sequential match requests with 22 bounded
  500-row JSONB batches inside the same atomic transaction. The CA is kept in gitignored
  `.secrets/`, never under application source.

### Supabase staging bootstrap evidence — 2026-09-03

- The owner applied all six tracked migrations after a clean dry run. `supabase migration list`
  reported identical local/remote versions from `20260702052851` through `20260902120000`.
- The current canonical snapshot was synced through the CA-verified session pooler connection.
  A separate read-only query confirmed 10,899 match rows, 45 distinct competitions, one snapshot,
  and latest snapshot ID `season-hydration-20260831024605687-a7c3b841`, exactly matching local data.
- This proves only the staging database bootstrap. Koyeb configuration/deployment, authenticated
  application smoke, live widget smoke, hourly workflow smoke, and rollback evidence remain open.

## Supabase Edge Function And Cloudflare Worker Owner Hosting — 2026-09-03

- **Owner decision**: replace the blocked Koyeb path with one Cloudflare Worker using Static Assets
  and an exact `/api` proxy to one Supabase Edge Function. Use the free `*.workers.dev` URL for
  staging; do not create a custom domain or paid service.
- **Runtime boundary**: Web-standard `Request`/`Response` becomes the API core boundary. The current
  Node HTTP process remains a local adapter, while the Edge Function uses a Deno entrypoint and must
  not import filesystem-backed serving/detail stores.
- **Persistence boundary**: keep the hosted Data API disabled. Prefer the Edge runtime's built-in
  `SUPABASE_DB_URL` with the Supabase-documented `postgres` driver, prepared statements disabled,
  and explicit transaction handling. The database URL/password never enters Cloudflare or browser
  configuration.
- **Security boundary**: configure the Edge Function with platform JWT verification disabled only
  because Miraichi uses its own owner session cookie, then require a separate constant-time gateway
  token before routing, body parsing, database work, or provider work. Cloudflare overwrites this
  header; direct Edge URL calls without it fail closed. Owner session auth and the refresh-only token
  remain separate controls.
- **Same-origin boundary**: Cloudflare serves the existing PWA assets and proxies only `/api` plus
  `/api/*`. It preserves the owner cookie and `Set-Cookie`, streams bodies, follows no upstream
  redirect, and marks API responses non-cacheable. No database or provider secret is stored there.
- **Region strategy**: staging proxy and cron invocations force `eu-central-1` so the Edge Function
  runs with the Frankfurt database. A later, explicitly approved production cutover uses a new Tokyo
  project and `ap-northeast-1`; Frankfurt remains intact for rollback until backup, smoke, and owner
  approval are complete.
- **Background refresh**: replace the GitHub Actions wake-up with one hourly `pg_cron` + `pg_net`
  call. The function URL, gateway token, and existing refresh-only token are resolved from Supabase
  Vault at execution time. Full-season hydration never runs in the Edge Function.
- **Measured static artifact**: `pnpm run build:web-static` produced 63 files totaling 385,801 bytes
  on 2026-09-03. This is far below Cloudflare Workers Free limits of 20,000 files per version and
  25 MiB per file.
- **Quota boundary**: Cloudflare static asset requests are free and unlimited; only `/api` proxy
  executions consume the 100,000 Worker requests/day quota. Supabase Free includes 500,000 Edge
  Function invocations/month, while its hosted runtime limits each request to 2 seconds CPU, 256 MB
  memory, and a 150-second Free wall-clock lifetime. These are ceilings, not availability promises.
- **Unproven hard gates**: official Deno documentation exposes `node:crypto.scrypt`, and Supabase
  documents `postgres` plus `SUPABASE_DB_URL`, but Miraichi has not yet run its exact scrypt cost,
  HMAC/session flow, parameterized query adapter, commit/rollback transaction, cookie round trip, or
  cron request in the actual Supabase Edge Runtime. Each must be observed locally in the Supabase
  runtime and then smoked on Frankfurt staging; failure stops the phase rather than weakening auth,
  enabling the Data API, or silently changing drivers.
- **Decision**: `docs/decisions/ADR-0052-supabase-edge-cloudflare-owner-hosting.md`.
- **Design**: `docs/superpowers/specs/2026-09-03-supabase-edge-cloudflare-owner-hosting-design.md`.
- **Runbook**: `docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md`.
- **Implementation plan**:
  `docs/superpowers/plans/2026-09-03-supabase-edge-cloudflare-owner-hosting.md`.

### Phase-plan closeout and transition

- The `phase:plan` exit gate is satisfied by the owner's explicit topology, security, scheduling,
  and Frankfurt-to-Tokyo decisions in the 2026-09-03 handoff. No new data source, public auth,
  multi-tenancy, paid service, or production change is approved.
- The earliest safe next phase is `phase:implementation-plan Supabase Edge Function and Cloudflare
  Worker owner hosting`. It must name exact files, the RED observation, minimal implementation,
  focused verification, and a separate local commit for every slice.
- No owner decision is currently missing for that implementation-plan phase. Implementation itself
  remains blocked until the exact TDD slice document exists.

### Implementation-plan closeout and transition

- The `phase:implementation-plan` exit gate is satisfied. The plan fixes ten sequential slices;
  every slice requires an observed RED, minimal GREEN, focused verification, and one local commit.
- Direct pnpm-workspace imports are not accepted as the deployment contract. Supabase documents a
  function-local dependency configuration and shared code below `supabase/functions`, while current
  CLI evidence leaves external monorepo imports unsafe. The plan therefore requires a deterministic
  self-contained Edge bundle plus an import-graph audit before the first runtime smoke.
- The earliest safe next phase is `phase:code-slice Supabase Edge Function and Cloudflare Worker
  owner hosting — Slice 1 Web HTTP primitives`.
- No owner decision is missing for Slice 1. Deployment, push, Frankfurt remote migration/secret
  changes, Tokyo project creation, production promotion, and Frankfurt deletion remain outside the
  code-slice authority.

### Local implementation evidence

- Slice 1 introduced bounded Web HTTP/JSON primitives in local commit `0820a9c`.
- Slice 2 moved the canonical API boundary to Web `Request`/`Response` while retaining Node as an
  adapter in local commit `8a27c17`.
- Slice 3 added the fail-closed gateway, deterministic Edge bundle, forbidden-import audit, and one
  `miraichi-api` function in local commit `4f4c426`. The actual Supabase CLI Edge Runtime returned
  the same generic `401` for missing/wrong gateway tokens and `200` for the authorized health
  request.
- Slice 4 added the version-pinned `postgres` Edge driver with `prepare: false`, one bounded
  connection, parameter binding, and transaction adaptation in local commit `ea47641`. The actual
  local Edge Runtime proved a bound-value query, forced rollback, committed transaction, cleanup,
  and a cloud status of `ready`; the probe route is unavailable outside explicit local smoke mode.
- Slice 5 exposed a real Deno compatibility defect: the Edge Runtime does not provide Node's
  `Buffer` global. Runtime modules now import `node:buffer` explicitly without changing scrypt cost,
  hash format, HMAC format, cookie policy, or TTL in local commit `243355d`. The actual runtime then
  proved scrypt `N=16384, r=8, p=1`, random salt generation, HMAC session verification, generic
  invalid login, hardened owner cookie, authenticated cloud route, refresh-token isolation, and
  logout expiry.
- Slice 6 added one Cloudflare Worker that delegates non-API requests to Static Assets and sends
  exact `/api` traffic to the single Edge Function with one upstream subrequest in local commit
  `d4402b3`. It overwrites the
  gateway/Frankfurt headers, preserves cookie/origin/body/query/`Set-Cookie`, removes hop-by-hop
  headers, disables API caching and redirects, and sanitizes upstream failures. Cloudflare accepts
  no database, provider, owner-password, session, or refresh credential binding.
- Slice 7 configured `apps/web/dist` as SPA Static Assets with Worker-first routing only for `/api`
  and `/api/*` in local commit `52623e2`. The build contains exactly 63 files, 385,780 total bytes,
  and a 54,672-byte largest file; same-origin API inspection and Wrangler 4.128.0 dry-run passed
  without deploying.
- Slice 8 added a locked-down Vault/pg_cron/pg_net migration that creates no job until the owner
  explicitly configures it in local commit `545f106`. Local SQL smoke proved missing-secret
  rejection, one idempotent minute-17 job, one sanitized rollback-only pg_net queue entry,
  idempotent unschedule, and removal of all disposable Vault values. The current GitHub hourly
  trigger remains as rollback until a Frankfurt cron smoke exists. On this Windows host, Supabase
  CLI 2.109.0 `db reset --local`
  recreated the database twice without applying migrations; explicit `migration up --local
  --include-all` applied all seven versions, after which the 10,899-match local snapshot was
  restored and verified.
- Windows had reserved the original `54320-54419` local port range. The checked-in local Supabase
  ports now use `15420-15429`; the local database, migration, schema, snapshot, lint, and security
  verification all passed on the replacement ports. This changes no hosted endpoint or database.
- Slice 9 added two cross-runtime integrations around the real Edge composition, PostgreSQL
  adapter contract, canonical Web API router, and Cloudflare proxy in local commit `b010e15`. Eight
  focused tests proved fail-closed direct Edge access, owner login/session/logout, refresh-token
  isolation, provider locator redaction, no hosted filesystem-detail fallback, transaction
  rollback, cookie/body/query preservation, one upstream request, persisted bankroll/bet flow,
  visible refresh, and terminal projection. The actual local Edge Runtime `all` smoke also passed
  every PostgreSQL and auth assertion; Edge bundle/graph verification and the 63-file Cloudflare
  dry-run artifact passed.
- Slice 10 corrected the staging runbook and documentation index, recorded every Slice 1–9 commit,
  and ran the complete closeout gate. An exact staging dry-run exposed the missing `env.staging`
  Wrangler declaration; a RED/GREEN configuration check now enforces it and the same command passes
  without that warning. Repeated full-gate runs also exposed four filesystem-heavy tests whose
  five-second limit caused nondeterministic timeout/cleanup failures under suite load; only those
  four cases now have a bounded 15-second timeout and pass together. `verify:local` passed 140 test
  files/703 unit tests plus syntax, type, architecture, and type-safety audits. `test:integration`,
  `verify:release`, and the local-only `verify:staging` command passed; the latter rebuilt the
  same-origin PWA. The final Edge `all` smoke again passed parameter binding, rollback, commit,
  cleanup, crypto, cookie, protected route, refresh isolation, and logout. Cloudflare verification
  again measured 63 files/385,780 bytes with a 54,672-byte largest file, and `git diff --check`
  passed.

### Local closeout transition — 2026-09-07

- **Fact**: the code/integration exit gate is satisfied locally. No push, deployment, remote
  migration, remote secret mutation, Vault scheduling, Tokyo project creation, production
  promotion, or Frankfurt deletion occurred.
- **Blocked staging actions**: the owner must explicitly authorize the push/deploy workflow and
  remote application of `20260903120000`; identify the exact staging `*.workers.dev` origin; and
  enter the documented secrets/configuration directly into Supabase, Vault, and Cloudflare.
- **Staging exit evidence still missing**: deployed Function/Worker IDs, direct gateway denial,
  Frankfurt region, hosted authenticated owner flow, real hosted transaction behavior, one
  pg_cron/pg_net delivery, and a rollback drill.
- **Recommendation**: start `phase:staging Supabase Edge Function and Cloudflare Worker owner
  hosting` only after those owner actions are explicitly approved. Production and Tokyo remain out
  of scope.

### Frankfurt staging evidence — 2026-09-08

- The owner explicitly authorized the Frankfurt staging push, remote migration, and Edge/Cloudflare
  deployment workflow.
- Local commits through `caa853f` were pushed to `origin/feat/api-football-rapid-ingestion`.
- Supabase project `qpexxwmrnreooxftfucv` was linked and `ACTIVE_HEALTHY` in `eu-central-1`.
  Migration dry-run named only `20260903120000_edge_hourly_live_refresh.sql`; it was applied and a
  fresh remote migration list matched all seven local versions. Supabase CLI 2.109.0 warned that it
  could not cache the post-push pg-delta catalog because its temporary CA file was absent, but the
  push exited successfully and the independent remote list verified the applied version.
- The owner entered the staging values only in gitignored local files. Supabase accepted exactly the
  nine reviewed Edge secret/config names. Direct missing/wrong gateway requests both returned the
  same `401 gateway_auth_required`; authorized health returned `200` from `eu-central-1`.
- Supabase Edge Function `miraichi-api` deployment ID
  `0e192eca-fc8e-4fe3-be44-748ef9a68609`, version 5, is `ACTIVE` with platform JWT verification
  disabled behind Miraichi's independent gateway and owner-session controls.
- Cloudflare Worker `miraichi-owner-gateway-staging` is live at
  `https://miraichi-owner-gateway-staging.quylang88.workers.dev`. Active version
  `1c71033f-f97f-42b9-9884-1862d64ad870` serves the 63-file/385,780-byte artifact and proxies API
  responses with `Cache-Control: no-store` while stripping all observed Supabase runtime headers.
- The first real cron delivery exposed a cross-driver JSONB bug: JSON serialized for Node `pg` was
  encoded as a JSON scalar by Edge `postgres.js`, violating the live-snapshot object constraint.
  Commit `caa853f` introduced explicit driver-specific JSON parameters. The RED test was observed;
  30 focused tests, typecheck, Edge build/graph verification, and repeated remote calls then passed
  with HTTP 200 (`refreshed` then `fresh`).
- Vault contains exactly the three reviewed scheduler names. The active job is unique, runs
  `17 * * * *`, and uses the exact invocation function. Natural runs at 09:17, 10:17, and 11:17 UTC
  were recorded as `succeeded`. The unschedule drill produced zero jobs while retaining all three
  Vault names; reconfiguration restored one active exact job as job ID 2.
- The GitHub Actions hourly schedule was removed only after the cron proof; `workflow_dispatch`
  remains as the manual rollback path.
- Static smoke, authenticated same-origin owner smoke, cloud persistence, 10,899-match snapshot,
  bankroll setup/read, draft-to-settlement, backup/export log, live read/manual refresh, redaction,
  hardened cookie, and logout all passed. Disposable owner data was removed and counts returned to
  zero. The inspected 200-row Edge log window matched zero configured secret values.
- Cloudflare was rolled back to prior working version
  `4824619d-6a8e-4857-a1c5-7d79de289108`, returned healthy, then restored to the remediated version
  at 100% traffic; restored health was `200` with zero observed internal headers.
- `pnpm run verify:staging` passed after remediation: 141 unit files/705 tests, every integration
  suite, endpoint E2E, PWA verification, audits, typecheck, and the final static build all passed.
  This is staging evidence only; production remains unapproved.

### Staging closeout and transition

- **Fact**: the `phase:staging` exit gate is satisfied by the full staging command, active
  deployments, fresh hosted owner/cron smoke, cleanup proof, and rollback drill.
- **Owner decision still required**: accept or reject this staging candidate in the final
  `phase:owner-feedback` review. No production action follows automatically.
- **Recommendation**: review the four-tab PWA at the recorded Worker origin, then explicitly approve
  or reject production preparation. If approved, the earliest safe next phase is a separate
  `phase:production` that creates a Tokyo project while retaining Frankfurt for rollback.

## Product Boundary

Miraichi has exactly four primary tabs: `Today`, `Matches`, `Bets`, and `Bankroll`.

The application may store and display factual fixtures, schedules, terminal results, statuses, teams, competitions, events, lineups, and factual statistics. Bet records, odds, stake points, settlements, notes, and bankroll ledger entries are entered or managed by the owner. The product does not generate picks, confidence scores, expected goals, stake recommendations, or automated betting calculations.

Competitions are configured through an allowlist and may be either `club` or `national-team`. Neither type has priority in core code. The 50 target competitions are equal; competition 51+ must be a registry-only addition.

## Historical SportScore Implementation Record — Network Operation Superseded

The checklist below records prior work; it is not current permission to call SportScore
`/api/v1`. Existing SportScore-sourced records retain required attribution.

- [x] Accept ADR-0048 and supersede ADR-0047 plus the external-source portion of ADR-0045.
- [x] Accept visible crawlable dofollow `Powered by SportScore` attribution on Today, Matches, and match detail when SportScore data is rendered.
- [x] Accept anonymous API operation with an optional free server-side key. The owner obtains and stores any key locally; secrets are never sent in chat or committed.
- [x] Accept best-effort terminal result freshness within 15–30 minutes, with no SLA and no live persistence/publication.
- [x] Accept approximately 50 daily per-competition fixture requests, then bounded competition-level terminal checks at +15 and +30 minutes.
- [x] Accept lazy terminal match detail and nullable/unavailable corners, cards, shots, possession, fouls, offsides, lineups, and event participants when upstream coverage is missing.
- [x] Reject HTML scraping, private endpoints, raw feed mirroring, browser-to-provider calls, and automated betting advice.
- [x] Write the design at `docs/superpowers/specs/2026-08-26-sportscore-public-api-source-design.md`.
- [x] Write the implementation plan at `docs/superpowers/plans/2026-08-26-sportscore-public-api-source.md`.
- [x] Complete Slice 0: remove API-Football executable code, config, tests, scripts, generated state, and current operational documentation while preserving superseded ADR history.
- [x] Complete Slice 1: add the validated 50-competition SportScore registry, 51st+ `national-team` extension proof, and provider-neutral SportScore source metadata without enabling network access.
- [x] Complete Slice 2: add the server-only anonymous/optional-key HTTP client, exact-origin containment, bounded cache/evidence, timeout, concurrency, retry, and sanitized request observations without wiring the worker.
- [x] Complete Slice 3: normalize registry-bound SportScore fixtures into provider-neutral canonical records, exclude in-play records before persistence, merge against last-good state, and atomically publish immutable warehouse/serving snapshots without writing match detail.
- [x] Complete Slice 4: fetch only competition-scoped fixture days, rotate work fairly with durable checkpoints, share +15/+30 terminal checks per competition window, use bounded recovery/backoff, and keep real network execution disabled by default.
- [x] Complete Slice 5: consume the existing lazy detail queue only for canonical completed matches, normalize terminal events/lineups/basic statistics, preserve nullable coverage, bound requests/retries, and negative-cache confirmed unavailable detail.
- [x] Complete Slice 6: expose sanitized source/freshness metadata, render conditional crawlable SportScore attribution on Today, Matches, and match detail, and show nullable detail statistics/lineups honestly in EN/VI.
- [x] Complete Slice 7 local integration: exercise all 50 equal competitions through restart checkpoints, 503 recovery, terminal-only publication, sanitized API serving, lazy terminal detail, and attribution; pin an offline contract fixture checksum and add guarded local operations. Real-network staging is not included.

## Historical SportScore TDD Slices

1. SportScore 50-competition registry and provider-neutral source contract.
2. HTTP client with anonymous/optional-key modes, exact-host containment, coalescing, timeout, and 429/503 backoff.
3. Terminal-only adapter, complete snapshot merge, and last-good atomic publication.
4. Daily per-competition sync plus bounded +15/+30 result checks and durable checkpoints.
5. Lazy terminal match detail with events, lineups, and optional team statistics.
6. Required attribution plus owner-facing freshness/unavailable states in EN/VI.
7. Large-boundary integration and separately approved contained staging validation.

## Evidence and hard limits

- Official developer documentation reviewed on 2026-08-26 advertises a free public JSON API, optional free key, approximately 10,000 requests per 24 hours per IP, 60-second edge caching, and no SLA.
- Official API terms require visible SportScore attribution and forbid raw-feed mirroring/bulk redistribution.
- Official OpenAPI documents day fixtures filtered by competition with a maximum of 200 records and match detail endpoints.
- The developer terms name free endpoints under `/api/widget/`, while OpenAPI marks `/api/v1/fixtures/` anonymous. This scope mismatch must be clarified before a real `/api/v1` staging call.
- Source validation observed all 50 target competitions and current/future fixtures plus finished results, but also intermittent anonymous HTTP 503 and inconsistent team-stat coverage.
- Therefore neither the 15–30 minute objective nor corners/shots/possession coverage is guaranteed. The UI must expose stale and unavailable states.
- No SportScore local mock or anonymous smoke counts as production approval.

## Slice 0 Local Evidence — 2026-08-26

- The boundary test was observed RED before implementation, then passed after removal.
- Focused verification passed 15 test files / 107 tests across product boundary, shared contracts, worker idle state, provider-neutral storage helpers, API routes, and web feed normalization.
- `pnpm run verify:local` passed 76 unit-test files / 428 tests, lifecycle, syntax, TypeScript, architecture audit, and type-safety audit.
- `pnpm run test:integration` passed Phase 3 verification, API endpoint E2E, and PWA verification with no external provider call.
- Executable-source search found no retired API-Football marker outside the boundary verifier itself.
- Generated API-Football ledger data and stale OpenFootball raw/warehouse artifacts were removed from `apps/api/data`; tracked provider-neutral README and warehouse structure remain.

## Slice 1 Local Evidence — 2026-08-26

- RED observed: the registry module was missing and shared validators rejected `sportscore` before implementation.
- All 50 configured mappings were matched by exact visible competition name to unique official SportScore directory URLs on 2026-08-26; no fixture or match API request was made.
- Focused verification passed 6 test files / 63 tests across the registry and shared contracts.
- Registry checks prove exactly 50 enabled entries, group counts 12/17/13/8, unique canonical IDs/slugs/provider IDs, HTTPS exact-host URLs, no priority/rank fields, and a valid 51st national-team entry.
- `pnpm run verify:local` passed 77 unit-test files / 436 tests, product boundary, lifecycle, syntax, TypeScript, architecture audit, and type-safety audit.
- Worker remains explicitly idle; no SportScore client, key, scheduler, persistence job, or real provider request exists in Slice 1.

## Slice 2 Local Evidence — 2026-08-26

- RED observed: the focused client suite failed because the SportScore client module did not exist before implementation.
- Focused verification passed 1 test file / 10 tests for anonymous and optional-key calls, exact-origin secret containment, documented fixture and match paths, full-response timeout, 429/503 bounded backoff, identical-request coalescing, concurrency cap, invalid JSON/envelope rejection, and bounded raw evidence with secret redaction.
- The complete worker unit suite passed 5 test files / 17 tests; the worker remains explicitly idle and no scheduler, ingestion, live publication, or external provider request is enabled.
- `pnpm run typecheck`, `pnpm run audit`, and `pnpm run verify:product-boundary` passed.
- Mock fixture fields were aligned to the current published OpenAPI `MatchSummary` schema using invented teams; no live SportScore payload is committed.
- Only public developer documentation/OpenAPI was read. No SportScore data endpoint was called, so this is local evidence only and does not resolve the `/api/v1/fixtures/` terms-scope blocker.

## Slice 3 Local Evidence — 2026-08-26

- RED observed: the adapter and publication job suites failed because their production modules did not exist before implementation.
- Focused verification passed 3 test files / 20 tests across the hardened client, the terminal-only adapter, and the publication job.
- Adapter tests cover scheduled, finished, postponed, cancelled, malformed, club, and national-team fixtures; canonical IDs contain no provider identity and in-play scores/events produce no canonical records, links, or provenance.
- Publication tests prove mixed live/scheduled responses cannot put live scores/events into canonical, serving, or detail stores; completed matches cannot regress even when kickoff changes; empty, partial, malformed, and all-live responses preserve the last-good manifest.
- The provider-neutral snapshot merge reuses an existing canonical match ID through private source links after a reschedule and refuses to replace an existing serving snapshot that lacks a resolvable warehouse run.
- Raw-evidence sanitization returns live records to the in-memory planner path but removes the entire live record, score, and events before bounded evidence is persisted.
- The complete worker suite passed 7 test files / 27 tests. `pnpm run phase3:verify`, `pnpm run typecheck`, `pnpm run audit`, `pnpm run verify:product-boundary`, and `pnpm run verify:lifecycle` passed.
- Worker scheduling remains explicitly idle. Slice 3 made no SportScore network request and did not enable daily sync or terminal rechecks.

## Slice 4 Local Evidence — 2026-08-26

- RED observed: the focused schedule/job suites failed because the source ledger, planner, lease, and daily sync job modules did not exist before implementation.
- Focused verification passed 2 test files / 14 tests for one competition/date per request, no global query, fair rotation, restart resume, shared simultaneous-match checks, +15/+30 timing, finite recovery/failure backoff, late-start live redaction, provider-query date reuse across timezone offsets, 429/503 deferral, last-good preservation, request cap, concurrency cap, lease exclusion, and non-overlapping timer ticks.
- SportScore plus the explicit worker-boundary verification passed 6 test files / 37 tests, including per-call retry suppression; the full worker suite passed 9 test files / 43 tests; `pnpm run typecheck` passed.
- Successful checkpoints advance only after a complete accepted response and publication decision. Failed provider/publication actions retain last-good data, keep the success checkpoint incomplete, and persist a future attempt time.
- Daily/result actions disable immediate client retries so `maxRequestsPerRun` caps actual HTTP attempts, not merely logical actions; 429/503 recovery occurs through the durable future checkpoint.
- A terminal window stops after four consecutive provider/coverage failures or two non-terminal recovery checks after +30, preserving an honest stale/exhausted state instead of retrying forever.
- The job requires an explicit owner-local `targetDate` and a competition-aware current-season resolver. It cannot silently substitute UTC day or invent a season label.
- The worker entrypoint remains idle by default. SportScore scheduling starts only when an already-configured job is explicitly injected; no real SportScore endpoint was called and the `/api/v1/fixtures/` terms-scope staging blocker remains unresolved.

## Slice 5 Local Evidence — 2026-08-27

- RED observed: the focused worker suite could not import the missing SportScore detail adapter/job, while the route suite proved cached lineups were being discarded.
- Focused verification passed 2 files / 19 tests; the complete local gate passed 83 test files / 477 tests plus product-boundary, lifecycle, syntax, TypeScript, architecture, and type-safety checks.
- The existing API route returns scheduled/unknown summaries without enqueueing and coalesces repeated completed cache misses. The new worker independently rejects scheduled and in-play queue records before a provider request.
- Each accepted detail item performs at most one HTTP attempt per run (`maxRetries: 0`), respects a run-level request ceiling, caches terminal normalized output, retries non-terminal/invalid responses with a durable future timestamp, and negative-caches missing source links or confirmed unavailable coverage.
- The provider-neutral detail contract now supports goals/cards/substitutions, FT/HT/ET/penalty breakdown, formations/lineups, corners, cards, shots, possession, fouls, and offsides. Missing optional values remain null/unavailable; no odds, picks, expected goals, live telemetry, raw provider IDs, or provider URLs enter the public detail payload.
- SportScore's published OpenAPI still does not provide a field-level response schema for match events, statistics, or lineups. Adapter tests therefore use invented defensive response shapes; real payload compatibility remains a staging-validation item and no SportScore data endpoint was called in this slice.

## Slice 6 Local Evidence — 2026-08-27

- RED observed: the web suite could not import the missing reusable attribution component, while API route tests proved private `sourceMatchId` and `sourceUrl` values escaped through the matches and snapshot-status boundaries.
- Focused verification passed 16 test files / 119 tests. `pnpm run verify:local` passed 84 unit-test files / 482 tests plus product-boundary, lifecycle, syntax, TypeScript, architecture, and type-safety checks. `pnpm run pwa:verify` also passed.
- The Miraichi matches and snapshot-status routes now retain only public `sourceId` plus `importedAt`; private provider match IDs and URLs remain inside persistence/source-link boundaries.
- Today, Matches, and ready/pending/unavailable match detail render one visible crawlable dofollow `Powered by SportScore` link only when the displayed feed or match contains SportScore provenance.
- EN/VI catalogs remain key-identical for attribution, fresh/stale/unavailable, pending detail, fouls, offsides, and lineup copy. Null or absent metrics render as unavailable while explicit zero remains zero; an empty lineup collection renders as unavailable.
- A browser smoke against an isolated mock API visually verified Today freshness, Matches attribution, terminal score/timeline/statistics/lineups, and unavailable values. It made no SportScore request, changed no active data root, and is not staging approval.

## Slice 7 Local Integration Evidence — 2026-08-27

- RED observed: the new integration suites could not import the missing contract/operations modules, and the 50-competition boundary exposed 50 duplicate public source entries after private provider IDs were removed.
- `pnpm run sportscore:integration` passed 4 test files / 12 tests. The boundary runs all 50 registry entries across capped restart runs, proves durable checkpoint completion, excludes an injected live score/event, defers and recovers from HTTP 503, serves 50 sanitized API matches, fulfills lazy terminal detail, and renders required attribution on Today, Matches, and detail.
- Public snapshot metadata now collapses private per-match source references to the newest safe `{ sourceId, importedAt }` entry per source instead of leaking IDs or returning dozens of indistinguishable duplicates.
- The approved offline OpenAPI fixture SHA-256 is `ab6564b124c1a907e3413d559618ebaea6313d6e143fad6189db0e2a584b6363`. Verification checks required fixture/detail paths and performs no network download.
- Guarded commands now exist for source/terms review, contract verification, sanitized checkpoint/status inspection, isolated empty-root preparation, and non-overwriting active-root bootstrap. Root overlap, invalid source ledgers, existing manifest/version/ledger conflicts, and concurrent file creation fail closed.
- `pnpm run verify:local` passed 87 test files / 488 tests. `pnpm run test:integration` passed SportScore integration, Phase 3 ingestion, endpoint E2E, and PWA checks. `pnpm run verify:staging` passed the same release gates plus a local static build; it did not deploy or call SportScore.
- At Slice 7 closeout, `pnpm run sportscore:status` reported the active root as `freshness: missing`, `matchCount: 0`, and zero checkpoints. The later owner-approved isolated evidence was explicitly bootstrapped only after validation.

## Season-Oriented Hydration Review And Remediation Evidence — 2026-08-28

- Review rejected the uncommitted claim of 25 supported free competitions. At verified
  OpenFootball tree `4e4146c901b62bcafa1b6deabb7e4a3fccdc9b1f`, current JSON exists for 9/50,
  past-1 for 24/50, and past-2 for 17/50.
- Only Premier League has exact kickoff times on every current row. The strict coverage result is
  1 supported, 24 partial, and 25 unsupported. football-data.org covers 10/50 on its free tier but
  needs a token; it is mapped as `pending-owner` and has no executable client in this phase.
- The provider-neutral registry at `packages/config/src/season-source-registry.ts` owns
  `fixtureSource`, `resultSource`, `detailSource`, `externalCompetitionId`, `endpointKind`,
  `seasonCycle`, exact source URLs, source IDs, available seasons, and verification metadata.
- The planner enforces a hard current-before-past barrier. A deferred current target blocks older
  seasons, and a newly enabled competition current target is selected before past work resumes.
- The provider-neutral checkpoint is isolated at
  `providers/season-hydration/state/ledger.json` and stores provider + competition + season plus
  optional ETag/cursor. It does not reinterpret the legacy SportScore date ledger.
- OpenFootball responses are bounded, full-response timed, ETag-aware, strict about partial
  envelopes, and stored as raw public-domain evidence. Date-only rows are retained raw but not
  published with an invented timestamp; exact local kickoff times are converted through the
  registry IANA timezone.
- One batch performs at most one merged warehouse/serving publication, regardless of fetched
  season count. This removes repeated full-snapshot I/O from the rejected implementation.
- SportScore local sync/schedule commands and worker schedule injection were removed. Product
  boundary verification prevents the retired date-hydration files and commands from returning.
- Focused evidence: 7 season integration files / 26 tests passed; worker idle-boundary tests,
  product-boundary verification, and TypeScript checks passed. No provider data request was made
  by tests.
- `pnpm run verify:release` passed on 2026-08-29: 94 unit files / 516 tests, 4 SportScore
  integration files / 12 tests, 7 season integration files / 26 tests, Phase 3 verification,
  endpoint E2E, PWA verification, lint, TypeScript, architecture, lifecycle, and type-safety gates.
- Active `apps/api/data` remained at 41 matches during review. Local checks are not staging or
  production approval.

## Prior FotMob Phase Closeout

The owner-approved FotMob current-season hydration code slice is complete locally. ADR-0049 remains
the controlling risk boundary: FotMob is primary, ESPN is disabled, and anti-bot circumvention is
forbidden. The guarded owner-local run completed all 45 executable current editions and classified
five editions as non-current/unpublished instead of fabricating data. The active serving store grew
from 41 preserved matches to 10,899 valid matches. Two live rows were excluded.

The real run used 48 requests: 45 final successes, six transient adapter failures recovered after a
TDD fix for structured status reasons, and three selected-season mismatches for unpublished cups.
Three failure records remain as forensic ledger evidence but are no longer executable current
targets. No SportScore `/api/v1` endpoint was called.

Final local evidence on 2026-08-31: `pnpm run verify:release` passed 97 unit files / 536 tests,
4 SportScore integration files / 12 tests, 9 season integration files / 44 tests, Phase 3, endpoint
E2E, PWA, lint, TypeScript, architecture, lifecycle, and type-safety gates. Local verification and
owner-local data are not staging or production approval.

Historical-season hydration is **PENDING by explicit owner decision on 2026-08-31**. The owner-local
CLI defaults to `pastSeasons: 0` and rejects every `--past-seasons` value above zero, so the five
evidence-backed historical targets cannot be executed accidentally. The earliest safe active work
is therefore `phase:maintenance` for bounded current-season validation and execution only.

The documented current-only command was replayed against the completed active ledger on 2026-08-31
and returned `status: idle`, zero requests, zero publications, 45 completed targets, 10,899 matches,
and `fresh` serving state. Serving validation, lifecycle verification, and product-boundary
verification passed without a provider request.

Maintenance verification on 2026-08-31 corrected the release gate so unit tests exclude the
separately orchestrated integration directory and filesystem-heavy tests use at most two workers on
Windows. The first unconstrained run reproduced I/O timeouts; every failed file passed sequentially.
After the gate correction, `pnpm run verify:release` passed 96 unit files / 536 tests, 4 SportScore
integration files / 12 tests, 9 season integration files / 45 tests, Phase 3, endpoint E2E, PWA,
lint, TypeScript, architecture, lifecycle, and type-safety gates.

If the owner later reopens historical work, the earliest safe next phase will be `phase:plan` for
exact provider-season mapping verification. Only five historical targets currently have explicit
provider-season evidence; the other 45 remain disabled to prevent guessed requests. Lazy FT detail
remains a separate, unapproved implementation plan. Cloud staging and production remain blocked.

## Daily Terminal Result And Current Revalidation Phase — 2026-08-31

- **Owner decision**: approved implementation of fast best-effort terminal-result updates and
  current-edition revalidation. Historical-season execution remains pending.
- **Verified daily contract**: direct anonymous `GET /api/data/matches` returned HTTP 200, ETag,
  `Cache-Control: max-age=10`, a 242,249-byte JSON body, 123 leagues, and 379 matches. Thirty-five
  matches across 12 currently active registry leagues were selected by pinned external league ID.
- **Terminal boundary**: only finished, cancelled, or postponed rows may update canonical data.
  In-play scores may influence the next in-memory check time but are never written to raw evidence,
  canonical warehouse, serving store, public API, or match detail.
- **Freshness objective**: first terminal check at scheduled kickoff +105 minutes, then no more than
  one coalesced global-date request every two minutes while a known match remains non-terminal.
  This targets a best-effort 0–2 minute delay after FotMob marks FT once the terminal window opens;
  it is not an SLA.
- **Request boundary**: no request when no match is due; all due matches on one provider date share
  one request; 403/429 opens the run circuit breaker; no retry storm or anti-bot workaround.
- **Current-edition revalidation**: recheck the 45 executable current season endpoints after a
  24-hour TTL, preserving registry order, ETag/304, current-only scope, and one publication per
  batch. This discovers newly published rounds without reopening historical hydration.
- **Design**: `docs/superpowers/specs/2026-08-31-fotmob-terminal-results-design.md`.
- **Implementation plan**: `docs/superpowers/plans/2026-08-31-fotmob-terminal-results.md`.

### Local implementation and integration evidence

- All eight planned slices followed RED -> GREEN -> focused verification -> local commit. Terminal
  checks use the global daily endpoint, coalesce due matches by provider date, persist a restart-safe
  provider/match/date ledger, and publish at most one merged canonical/serving snapshot per run.
- The once/watch runtime requires explicit network confirmation, targets only the validated active
  data root, allows at most two provider dates per tick, wakes serially every 30 seconds, and makes
  zero requests until the ledger says a known match is due.
- Current-edition revalidation uses a 24-hour TTL, saved ETag/304, registry order, and a hard
  nine-request batch limit. Both the CLI and worker job reject every historical-season execution
  while historical work is pending.
- Large-boundary integration proves terminal-only publication through Miraichi
  `GET /api/v1/matches`, live-score exclusion, restart timing, last-good preservation on 429, and
  nine-at-a-time current revalidation without historical eligibility.
- Season revalidation and terminal-result jobs share one canonical-publication lease. Concurrent
  runs return `lease_busy` before reading/publishing, preventing a stale-base last-writer-wins data
  loss between the two otherwise separate pipelines.
- Active-root revalidation was replayed on 2026-08-31 only after read-only ledger inspection proved
  all 45 checkpoints were younger than 24 hours. It returned `idle`, zero requests, zero
  publications, 10,899 matches, and fresh serving data.
- During the RED test for the new job-level historical hard stop, the missing test double allowed
  one unintended **current-season** FotMob request against a temporary data root. No historical
  endpoint was requested; the test was immediately isolated and the job boundary now rejects before
  provider execution. This does not change ADR-0049 risk or authorize further test network calls.
- Final local gate on 2026-08-31: `pnpm run verify:release` passed 103 unit files / 576 tests,
  4 SportScore integration files / 12 tests, 9 season integration files / 52 tests, and 8 FotMob
  terminal integration files / 35 tests, plus Phase 3, endpoint E2E, PWA, lint, TypeScript,
  architecture, lifecycle, product-boundary, and type-safety verification.
- No SportScore `/api/v1` request, staging deployment, production promotion, or push occurred.
  FotMob terms/robots risk remains owner-accepted and the implementation contains no bypass.

### Maintenance boundary and next phase

- Strict registry coverage remains **41 supported, 9 partial, 0 unmapped**. Executable current
  editions remain **45/50**. The currently unavailable/non-current editions are Club World Cup,
  FA Cup, Copa del Rey, Coupe de France, and KNVB Beker.
- Historical-season hydration remains **PENDING**. Reopening it requires a new `phase:plan` and
  exact provider-season evidence; 45 historical mappings still cannot be guessed.
- Lazy FotMob match detail is not implemented. If the owner wants events, lineups, or statistics,
  the earliest safe next development phase is `phase:plan FotMob lazy terminal match detail`.
- Local release evidence is not staging or production approval. Those gates remain blocked until a
  separate owner decision explicitly accepts promotion under the unofficial-source risk.

All work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.

## Single-Bankroll Usable Owner Flow — 2026-09-01

- **Owner decision**: replace visible multi-account UX with one visible bankroll while preserving an
  internal account identity for settlement, ledger, backup, and legacy compatibility.
- **Approved remediation**: close the reviewed settlement/PATCH invariant hole, reject invalid
  bankroll signs and balances, make first-run setup actionable, complete the draft-to-ongoing path,
  warn on overexposure, add explicit friction for chasing/FOMO/impulse motivations, decouple factual
  reports from configured discipline thresholds, and never render unavailable P&L as zero.
- **Compatibility boundary**: no account or owner data may be deleted or silently merged. Existing
  multi-account data remains readable; the normal V1 UI must not create new secondary accounts or
  require an account choice for each bet.
- **Product boundary**: the phase adds no picks, stake recommendation, Kelly, ROI, CLV, drawdown,
  expected-return, or automated risk formula. All thresholds remain owner-entered warning inputs.
- **Deferred work**: historical-season hydration and lazy match detail are both `PENDING` and outside
  this phase. No provider request, staging promotion, production schema application, or push is
  approved.
- **Decision**: `docs/decisions/ADR-0050-single-bankroll-usable-owner-flow.md`.
- **Design**: `docs/superpowers/specs/2026-09-01-single-bankroll-usable-owner-flow-design.md`.
- **Implementation plan**: `docs/superpowers/plans/2026-09-01-single-bankroll-usable-owner-flow.md`.

### TDD and commit evidence

- Planning gate: `1b6814d docs: approve single bankroll owner flow`.
- Slice 1, bankroll and settlement invariants: `9448592 fix: protect bankroll accounting invariants`.
- Slice 2, deterministic primary-bankroll setup: `b08f614 feat: add single bankroll owner setup`.
- Slice 3, owner UI and draft conversion: `aacf7f0 feat: simplify single bankroll owner flow`.
- Slice 4, pre-bet discipline checks: `2b35830 feat: enforce pre-bet discipline checks`.
- Slice 5, factual bankroll and psychology reports: `e402d58 fix: keep bankroll reports factual`.
- Slice 6 closes the normal integration chain and endpoint smoke contract in the local closeout
  commit after the complete release gate passes.

### Local closeout evidence

- The normal integration chain now covers primary-bankroll setup, overexposure and risky-motivation
  warnings, the 15-second challenge, server-side primary-account binding, immutable pre-bet plan
  adherence, settlement correction, psychology reporting, and V2 backup round-trip.
- `pnpm run verify:release` passed on 2026-09-01: product-boundary and lifecycle checks, 615 unit
  tests across 108 files, lint, typecheck, audit, type-safety checks, phase verification, 12 focused
  SportScore contract tests, 52 season integration tests, 35 FotMob terminal integration tests,
  endpoint E2E, and PWA verification.
- SportScore contract verification reported `networkUsed: false`. This phase made no provider call,
  did not modify or delete the active `apps/api/data` snapshot, and did not run staging, production
  schema application, deployment, or push.

### Phase transition recommendation

- This phase is complete locally. The earliest safe next phase is
  `phase:maintenance Single-bankroll owner-local database migration and smoke`: apply the two tracked
  schema migrations to a configured owner-local Supabase instance, exercise first-run setup and the
  draft-to-settlement UI flow, and record evidence without treating it as staging approval.
- Historical-season hydration and lazy match detail remain explicitly `PENDING`; neither belongs in
  that maintenance phase.
