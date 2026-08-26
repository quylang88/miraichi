# Project Plan

## Current State

- **Status**: Active
- **Completed boundary**: Product Reset — owner-only factual match data, manual bets/odds, and bankroll management.
- **Superseded phase**: The API-Football staging path is cancelled. Its Free plan did not provide current-season entitlement, so no further provider request or production promotion is approved.
- **Completed phase**: `phase:plan SportScore Public API Validation And Source Boundary` — owner accepted SportScore, visible attribution, optional local key handling, and complete API-Football implementation removal on 2026-08-26.
- **Completed phase**: `phase:implementation-plan SportScore Public API Validation And Source Boundary` — ADR-0048, the design spec, and the exact TDD slice plan are written.
- **Active phase**: `phase:code SportScore Public API Source — Slice 1 registry and source contract` — implementation and local exit gate passed on 2026-08-26; transition awaits the next explicit owner command.
- **Promotion state**: SportScore Slice 1 implementation is complete locally; Slice 2+, integration, staging, owner feedback, and production have not started.
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

## Next Gate

The recommended next phase is `phase:code SportScore Public API Source — Slice 2 HTTP client, optional key, cache, and failure policy`.

All work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
