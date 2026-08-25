# ADR-0047: API-Football Rapid Match Ingestion & Extensible 50-League Multi-Season Hydration

- **Status**: Accepted
- **Date**: 2026-08-25
- **Owner approval**: Explicitly approved by the project owner on 2026-08-25.
- **Supersedes**: ADR-0045 (for external match data source feed).

## Context

Miraichi requires broad fixture and result coverage across 50 prominent club and cup competitions globally, with match results updated on the API within <= 5 minutes of match conclusion (`FT`). 

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
   - API credentials (`RAPIDAPI_KEY` / `API_FOOTBALL_KEY`) remain strictly server-side in backend worker environment variables; no credentials or provider URLs are ever exposed to the client browser.
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

4. **Smart Window Poller (<= 5-minute SLA within 100 req/day quota)**:
   - *Daily Sync (1 req/day)*: `GET /fixtures?date=today` fetches all scheduled matches worldwide for the day.
   - *Concluding Window Polling*: For active matches, worker polls clustered fixtures in batch (`GET /fixtures?ids=...`) every 2.5 minutes between $T_{\text{kickoff}} + 88\text{m}$ and $T_{\text{kickoff}} + 115\text{m}$.
   - *Early Exit & Atomic Publication*: As soon as all matches in the batch reach `FT` (or `AET`/`PEN`), polling stops immediately, and the Serving Store snapshot is atomically rebuilt.
   - *Quota Guard*: Hard ceiling at 85 requests/day + 15 emergency reserve to guarantee zero quota overrun.

5. **Legacy Cleanup**:
   - All OpenFootball registries, text parsers, capture scripts, and fixtures are deleted.

## Consequences

- Match results reflect on `/api/matches` within <= 5 minutes of final whistle.
- Free tier quota (100 req/day) is strictly protected with >= 50% safety margin during normal daily operation.
- The app has rich historical data (1–2 past seasons) and complete future season fixtures for 50 major leagues.
- Complete competition-agnostic architecture ensures adding or removing leagues is frictionless.
