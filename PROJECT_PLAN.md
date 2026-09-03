# Project Plan

## Current State

- **Status**: Active
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
- **Active phase**: `phase:staging Owner-hosted API and visibility-driven live overlay` — owner-created Supabase staging is migrated and contains the verified current canonical snapshot; Koyeb deployment and smoke gates remain incomplete.
- **Historical-season state**: **PENDING by owner decision on 2026-08-31**. Past-1 and past-2 execution must not run until the owner explicitly reopens `phase:plan` for exact provider-season verification.
- **Lazy match-detail state**: **PENDING by owner decision on 2026-09-01**. It is excluded from the active bankroll phase and may reopen only through a separate `phase:plan FotMob lazy terminal match detail`.
- **Promotion state**: The active `apps/api/data` snapshot is fresh with 10,899 matches across 45 current competition editions and its exact snapshot is synced to Supabase staging. Koyeb deployment, owner-feedback release gate, and production promotion have not run.
- **Current lifecycle source of truth**: this file.

## Owner-Hosted API And Visibility-Driven Live Overlay — 2026-09-02

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
