# SportScore Public API Source Implementation Plan

- **Date**: 2026-08-26
- **Lifecycle phase**: `phase:implementation-plan SportScore Public API Validation And Source Boundary`
- **Decision**: ADR-0048
- **Execution rule**: Each slice starts with the named failing test, implements only that slice, runs focused verification, and commits locally. No real network call is authorized by a code-slice test.

## Slice 0 — Retire API-Football completely

**Test first**

- Modify `scripts/product-boundary-verify.test.ts` to prove API-Football paths, package commands, source IDs, and environment markers are rejected.
- Run `pnpm exec vitest run scripts/product-boundary-verify.test.ts` and observe RED against the current repo boundary.

**Implementation**

- Delete API-Football config, worker sources/jobs, CLI scripts, integration/unit tests, and generated runtime data.
- Remove API-Football from shared provider/source unions and provider-specific validation.
- Remove the worker scheduler and leave an explicit no-provider idle boundary until Slice 3.
- Remove environment variables, package commands, audit allowlist entries, route special cases, and provider-specific fixtures from generic tests.
- Replace provider-specific data README instructions with provider-neutral storage guidance.
- Keep ADR-0047 and its old implementation plan, marking ADR-0047 superseded.

**Verify**

- `pnpm exec vitest run scripts/product-boundary-verify.test.ts packages/shared/src/contracts apps/worker/src/index.test.ts scripts/providers/shared`
- `pnpm run verify:product-boundary`
- `rg -n -i "api[-_ ]football|apifootball" apps packages scripts .env.example package.json`

## Slice 1 — SportScore registry and source contract

**Status**: Complete locally on 2026-08-26; not staging evidence.

**Test first**

- Create `packages/config/src/sportscore-source-registry.test.ts` for exactly 50 enabled, unique canonical IDs/slugs, all four accepted groups, `club | national-team`, and deterministic 51+ extension.
- Extend shared contract tests to accept `sportscore` only as a private source reference and reject provider IDs in canonical/public fields.

**Implementation**

- Create `packages/config/src/sportscore-source-registry.ts` with the 50 declarative mappings and validation date.
- Export it from `packages/config/src/index.ts`.
- Add provider-neutral SportScore raw source metadata without changing canonical identity.

**Verify**

- `pnpm exec vitest run packages/config/src/sportscore-source-registry.test.ts packages/shared/src/contracts`
- `pnpm run audit`

## Slice 2 — HTTP client, optional key, cache, and failure policy

**Status**: Complete locally on 2026-08-26; no provider data endpoint was called and this is not staging evidence.

**Test first**

- Create `apps/worker/src/sources/sportscore/sportscore-client.test.ts` covering anonymous/keyed requests, exact-host secret containment, timeout, 429/503 backoff, edge-cache coalescing, concurrency cap, and invalid JSON.
- Add fixtures derived from the documented schema with invented team names; do not commit live provider payloads.

**Implementation**

- Create `sportscore-client.ts`, `sportscore-response-contract.ts`, and a bounded private raw-evidence cache.
- Add `SPORTSCORE_API_KEY` as optional server-only configuration and `SPORTSCORE_BASE_URL` as a validated HTTPS exact-host override for tests only.
- Record request metadata without secret headers.

**Verify**

- `pnpm exec vitest run apps/worker/src/sources/sportscore`
- `pnpm run typecheck`

## Slice 3 — Terminal-only adapter and last-good publication

**Status**: Complete locally on 2026-08-26; worker scheduling and provider network execution remain disabled.

**Test first**

- Create `sportscore-adapter.test.ts` for scheduled, finished, postponed, cancelled, malformed, club, and national-team fixtures.
- Create `sportscore-publication.test.ts` proving live scores/events never enter canonical, serving, or detail stores; terminal status is monotonic; partial/empty invalid responses preserve last good.

**Implementation**

- Normalize provider records into canonical teams, competitions, matches, source links, and provenance.
- Reuse provider-neutral snapshot merge/publication code; extract shared code if current placement is provider-specific.
- Wire the worker only after all publication tests pass.

**Verify**

- `pnpm exec vitest run apps/worker/src/sources/sportscore apps/worker/src/jobs/sportscore-publication-job.test.ts`
- `pnpm run phase3:verify`

## Slice 4 — Daily per-competition sync and +15/+30 terminal checks

**Status**: Complete locally on 2026-08-26; worker remains idle unless a configured job is explicitly injected, and no provider endpoint was called.

**Test first**

- Create scheduler/checkpoint tests proving one request per enabled competition/day, no global 200-item query, fair rotation, shared competition-level terminal rechecks, +15/+30 timing, restart resume, and no tight live loop.
- Prove 429/503 deferrals do not advance successful checkpoints or erase data.

**Implementation**

- Add durable source ledger, lease, daily sync job, result-check planner, and worker schedule.
- Cap concurrency and total requests per run independently of the provider's advertised limit.

**Verify**

- `pnpm exec vitest run apps/worker/src/jobs/sportscore-daily-sync-job.test.ts apps/worker/src/sources/sportscore/sportscore-schedule-planner.test.ts`
- `pnpm run typecheck`

## Slice 5 — Lazy terminal match detail

**Test first**

- Create adapter/job tests for goals, cards, substitutions, lineups/formations, score breakdown, and optional team stats.
- Prove missing stats stay null/unavailable, scheduled/in-play matches trigger no detail request, completed cache misses coalesce, and unavailable coverage is negatively cached.

**Implementation**

- Extend provider-neutral detail contracts only where required for lineups, fouls, and offsides.
- Add the SportScore detail adapter/job behind the existing API queue and terminal cache.

**Verify**

- `pnpm exec vitest run apps/worker/src/jobs/sportscore-match-detail-job.test.ts apps/api/src/routes/match-detail.test.ts`

## Slice 6 — Attribution and owner-facing freshness

**Test first**

- Add web tests proving visible dofollow `Powered by SportScore` attribution on Today, Matches, and detail when SportScore-derived data is displayed.
- Add EN/VI parity tests for stale, unavailable, pending, and provider attribution copy.

**Implementation**

- Add one reusable attribution component and source/freshness metadata from the Miraichi API.
- Render null detail metrics as unavailable, never zero.

**Verify**

- `pnpm exec vitest run apps/web/src`
- `pnpm run pwa:verify`

## Slice 7 — Integration and contained staging validation

**Status**: Local integration and an owner-approved isolated anonymous one-shot are complete on 2026-08-27; cloud staging remains blocked by the `/api/v1` terms-scope mismatch and requires separate owner approval.

**Test first/local integration**

- Add integration tests for all 50 registry entries using mocked HTTP, restart checkpoints, 503 recovery, terminal-only publication, API serving, lazy detail, and attribution.
- Add a contract-drift verifier that checks an approved local OpenAPI fixture checksum; it must not silently download a new schema during release verification.

**Implementation**

- Add explicit owner commands for terms/OpenAPI review, quota/status inspection, isolated smoke root, and active-root bootstrap.
- Document anonymous and optional-key operation without printing secrets.

**Local gates**

- `pnpm run verify:local`
- `pnpm run test:integration`
- `pnpm run verify:staging`
- `git diff --check`

**Staging gate**

- Requires separate owner approval for a bounded real-network smoke.
- Requires published or written confirmation that attributed free use covers `/api/v1/fixtures/`; otherwise the smoke is blocked before any request.
- Validate one current fixture query and one finished match detail in an isolated ignored root, including attribution and secret containment.
- Do not promote to production until current coverage, 503 behavior, deployed API routing, and owner feedback pass.

## Exit criteria

- API-Football is absent from executable code, config, scripts, tests, and runtime data.
- SportScore covers all 50 registry entries without competition priority.
- Current fixtures and terminal results work with best-effort 15–30 minute checks and honest stale states.
- Match detail provides available factual events/lineups/basic stats without inventing missing values.
- Required attribution appears on all three approved surfaces.
- Local verification, integration, staging, owner feedback, and production remain distinct gates.
