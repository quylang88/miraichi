# ADR-0047: API-Football Rapid Match Ingestion & Extensible 50-League Multi-Season Hydration

- **Status**: Accepted
- **Date**: 2026-08-25
- **Owner approval**: Explicitly approved by the project owner on 2026-08-25.
- **Amendment approval**: On 2026-08-25 the owner explicitly approved a best-effort result SLO <= 5 minutes, terminal-only result/detail publication plus lazy completed-history match-detail caching, and continued `club | national-team` configuration support. Provider live responses are used only to decide whether terminal polling must continue; they are not persisted or published.
- **Supersedes**: ADR-0045 (for external match data source feed).

## Context

Miraichi requires broad fixture and result coverage across 50 prominent club and cup competitions globally, with a best-effort objective of publishing match results within <= 5 minutes of match conclusion (`FT`) while provider availability, known-fixture state, and normal quota make the attempt eligible.

OpenFootball (ADR-0045) was a structured-text dataset maintained asynchronously by GitHub contributors. While CC0 and credential-free, OpenFootball cannot meet the 5-minute result SLA because upstream file updates occur hours or days after matches finish, and coverage is limited. Furthermore, previous phases contained hardcoded biases toward certain tournaments (e.g. World Cup national-team priority).

The project owner requires:
1. Complete removal of OpenFootball and elimination of all hardcoded competition priorities in core code.
2. Direct integration with API-Football (api-sports.io) as the single competition-agnostic match data provider.
3. Extensible configuration registry of 50 prominent club and cup competitions with equal first-class status.
4. Multi-season historical data seeding (hydration) covering current season schedules + past 1–2 seasons of results.
5. Strict operation within the 100 requests/day Free Tier quota using Smart Window Polling (<= 85 req/day ceiling + 15 reserve).

## Decision

1. **Provider Adoption & Boundary**:
   - API-Football is accepted as the authorized external match data provider.
   - The direct-dashboard API credential (`API_FOOTBALL_KEY`) remains strictly server-side in backend worker environment variables; no credentials or provider URLs are ever exposed to the client browser. RapidAPI transport is outside this accepted implementation boundary unless separately reviewed.
   - All provider payloads are normalized through `ApiFootballAdapter` into canonical warehouse models (`CanonicalMatch`, `CanonicalTeam`, `CanonicalCompetition`, `FieldProvenance`), keeping core domain and serving contracts 100% provider-neutral.

2. **Extensible 50-Competition Declarative Registry**:
   - Competitions are configured in `packages/config/src/api-football-source-registry.ts`.
   - Each entry declares `id`, `name`, `country`, `providerLeagueId`, `season`, `type`, and `enabled`.
   - No hardcoded competition IDs or national-team priorities are permitted in core application, worker, or API code.
   - Adding a 51st competition requires adding a single declarative entry with zero modifications to business logic.

3. **Multi-Season Historical Hydration Pipeline**:
   - `apps/worker/src/jobs/api-football-hydration-job.ts` pulls current season fixtures + past 1–2 seasons of results per league.
   - `HydrationCheckpointManager` maintains an idempotent ledger tracking completed `[leagueId, season]` pairs.
   - Checkpointed resume prevents duplicate requests across restarts or daily quota limits.
   - Any newly added competition in the future is automatically hydrated on first run.

4. **Smart Window Poller (best-effort <= 5-minute SLO within 100 req/day quota)**:
   - *Daily Sync (1 req/day)*: `GET /fixtures?date=today` fetches all scheduled matches worldwide for the day.
   - *Concluding Window Polling*: The worker polls only due fixtures in batches of at most 20 IDs. Normal result polling begins no earlier than kickoff + 100 minutes, runs at 2.5-minute cadence, and follows provider status through extra time or penalties up to a bounded +180-minute recovery window.
   - *Early Exit & Atomic Publication*: As soon as all matches in the batch reach `FT` (or `AET`/`PEN`), polling stops immediately, and the Serving Store snapshot is atomically rebuilt.
   - *Quota Guard*: A durable cross-restart ledger enforces the 85-request normal ceiling, retains 15 requests outside automatic use, respects the free per-minute limit, and reconciles provider response headers.

5. **Basic Match Detail**:
   - Only terminal fixture batches normalize factual referee, elapsed time, score breakdown, events, and the approved two-team statistics into a provider-neutral local detail cache.
   - A completed historical cache miss is queued by canonical match ID; the worker resolves provider identity server-side, fetches lazily within normal quota, and caches the result.
   - Non-terminal provider responses are polling control only. They do not mutate the canonical warehouse, serving store, or match-detail cache.
   - The API route never calls API-Football directly and never exposes credentials, provider URLs, or provider fixture IDs.
   - Basic detail excludes predictions, xG, automated betting advice, player ratings, and bulk historical player hydration.

6. **Competition Type Boundary**:
   - The initial 50 entries are club competitions, but registry and canonical contracts continue to accept both `club` and `national-team` without core-code priority.

7. **Legacy Cleanup**:
   - All OpenFootball registries, text parsers, capture scripts, and fixtures are deleted.

## Consequences

- Eligible match results target publication on `/api/matches` within <= 5 minutes of final whistle; quota/provider/coverage deferrals are reported honestly and do not constitute a hard SLA.
- Free tier quota (100 req/day) reserves the final 15 requests outside automatic normal operation and reconciles provider-reported usage.
- After successful hydration, the app retains current schedules plus the configured 1–2 historical seasons for 50 competitions.
- Complete competition-agnostic architecture ensures adding or removing leagues is frictionless.
