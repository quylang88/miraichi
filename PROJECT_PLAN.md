# Project Plan

## Current State

- **Status**: Active
- **Completed boundary**: Product Reset — owner-only factual match data, manual bets/odds, and bankroll management.
- **Superseded phase**: The API-Football staging path is cancelled. Its Free plan did not provide current-season entitlement, so no further provider request or production promotion is approved.
- **Completed phase**: `phase:plan SportScore Public API Validation And Source Boundary` — owner accepted SportScore, visible attribution, optional local key handling, and complete API-Football implementation removal on 2026-08-26.
- **Completed phase**: `phase:implementation-plan SportScore Public API Validation And Source Boundary` — ADR-0048, the design spec, and the exact TDD slice plan are written.
- **Active phase**: `phase:code SportScore Public API Source — Slice 6 required attribution and owner-facing freshness/unavailable states` — implementation and local exit gate passed on 2026-08-27; transition awaits the next explicit owner command.
- **Promotion state**: SportScore Slices 0–6 are complete locally; Slice 7 integration, staging, owner feedback, and production have not started.
- **Current lifecycle source of truth**: this file.

## Product Boundary

Miraichi has exactly four primary tabs: `Today`, `Matches`, `Bets`, and `Bankroll`.

The application may store and display factual fixtures, schedules, terminal results, statuses, teams, competitions, events, lineups, and factual statistics. Bet records, odds, stake points, settlements, notes, and bankroll ledger entries are entered or managed by the owner. The product does not generate picks, confidence scores, expected goals, stake recommendations, or automated betting calculations.

Competitions are configured through an allowlist and may be either `club` or `national-team`. Neither type has priority in core code. The 50 target competitions are equal; competition 51+ must be a registry-only addition.

## Accepted SportScore Boundary

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

## Planned TDD Slices

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

## Next Gate

The recommended next phase is `phase:integration-test SportScore Public API Source — Slice 7 large-boundary integration and contract-drift verification`.

This next phase is local-only and needs no further owner decision. Any real-network SportScore smoke remains a separate staging gate requiring explicit owner approval plus resolution of the `/api/v1` terms-scope mismatch.

All work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
