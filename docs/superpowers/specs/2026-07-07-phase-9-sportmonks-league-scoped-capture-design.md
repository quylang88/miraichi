# Phase 9 Sportmonks League-Scoped Capture Design

## Status

- Status: Owner-approved design direction
- Date: 2026-07-07
- Lifecycle boundary: Phase 9 raw provider capture only

## Goal

Add one resumable command that captures the useful non-live Sportmonks data for a selected league without crawling global feeds with thousands of unrelated pages.

Example:

```powershell
pnpm run data:capture:sportmonks:league -- --league-id=8
```

The default run uses every season already discovered for the league. Operators may restrict the run with `--season-id` or `--max-seasons`.

## Owner Decisions

- Use league-scoped inventory fan-out instead of completing large global feeds.
- Default to all discovered seasons for the requested league.
- Support `--season-id` and `--max-seasons` limits.
- Execute capture immediately; no `--dry-run` mode is required.
- Reuse existing raw payloads and manifests. Do not fetch an exact request twice when the existing payload is valid and complete.
- Exclude live scores, in-play odds, and `expected.lineups`.
- Capture xG through the fixture `xGFixture` include instead of finishing the global expected-player feed.

## Scope

### Included

- League inventory discovery from existing Sportmonks raw data.
- Exact request deduplication and pagination resume.
- Coverage-aware reuse of completed global and scoped captures.
- Season-scoped, fixture-scoped, team-scoped, and league-scoped raw capture.
- A per-run JSON coverage report.
- Local-only Sportmonks token handling through the existing client/config boundary.

### Excluded

- AI training, feature engineering, model selection, or prediction runtime.
- Betting recommendations, ROI, CLV, Kelly, stake sizing, or bankroll formulas.
- App contract expansion with provider-specific rich fields.
- Live scores and in-play odds.
- Player-level expected values from `/expected/lineups`.
- Automatic warehouse promotion or deletion of existing raw payloads.
- A dry-run mode.

## Design Decision

Use an inventory fan-out pipeline:

```text
league ID
  -> discovered season IDs
  -> season team IDs and fixture IDs
  -> scoped season/team/fixture requests
  -> raw cache + manifest
  -> league capture report
```

This is preferred over adding a league filter to every global endpoint because Sportmonks does not expose one consistent league filter across odds, transfers, rankings, squads, news, and xG. Official by-fixture, by-team, by-season, and by-league endpoints provide deterministic boundaries.

## Command Interface

Primary command:

```powershell
pnpm run data:capture:sportmonks:league -- --league-id=8
```

Supported controls:

```text
--league-id=<positive integer>     Required.
--season-id=<id>                   Optional; repeatable. Restricts discovered seasons.
--max-seasons=<positive integer>   Optional; takes the newest discovered seasons.
--group=<name>                     Optional; repeatable. Values: season, fixture, team, ai.
--max-requests=<positive integer>  Optional hard request budget for one run.
--no-skip-existing                 Optional explicit recapture override.
```

The default groups are `season`, `fixture`, `team`, and `ai`.

## Inventory Discovery

1. Read existing `fixtures.all` raw envelopes and select records whose `league_id` matches the requested league.
2. Read existing `seasons.all` raw envelopes to resolve season metadata and ordering.
3. Apply explicit `--season-id` restrictions when present.
4. Otherwise use all discovered seasons, or the newest `--max-seasons` seasons.
5. Resolve fixture IDs from the selected league and seasons.
6. Resolve team IDs from `teams.bySeasonId` raw payloads and fixture participants.
7. Fail with an actionable prerequisite message when no season or fixture inventory exists. The league runner must not silently start another global crawl.

## Capture Bundle

### Global Reference Reuse

The runner checks existing terminal captures for global reference entities and does not fetch them per league:

- types
- states
- countries and regions
- markets and bookmakers
- teams, players, venues, coaches, and referees when the global capture is terminal

Global reference absence is reported. It does not authorize an implicit global crawl.

### Season Group

For every selected season:

- `/schedules/seasons/{seasonId}`
- `/teams/seasons/{seasonId}`
- `/standings/seasons/{seasonId}`
- `/venues/seasons/{seasonId}`
- `/referees/seasons/{seasonId}`
- `/news/pre-match/seasons/{seasonId}`
- `/news/post-match/seasons/{seasonId}`
- `/topscorers/seasons/{seasonId}`

Standing corrections remain optional evidence. Repeated subscription-level unavailability is reported and not retried indefinitely.

### Fixture Group

For every selected fixture:

- Fixture enrichment through `/fixtures/{fixtureId}`.
- Standard pre-match odds through `/odds/pre-match/fixtures/{fixtureId}` when the enrichment payload lacks odds coverage.
- Commentaries through `/commentaries/fixtures/{fixtureId}` when the enrichment payload lacks comments.

Fixture enrichment remains the primary rich payload and includes scores, participants, statistics, events, lineups, league, season, stage, round, venue, state, periods, metadata, formations, referees, coaches, odds, predictions, `xGFixture`, and pre/post-match news.

### Team Group

For every selected team:

- `/transfers/teams/{teamId}`
- `/transfer-rumours/teams/{teamId}`
- `/team-rankings/teams/{teamId}`
- `/statistics/seasons/teams/{teamId}` filtered with the provider-supported `seasonLeagues:{leagueId}` filter

For every selected team and season pair:

- `/squads/seasons/{seasonId}/teams/{teamId}`

Team season statistics must retain only the requested league through the documented season-league filter. A team moving between competitions must not pull unrelated season statistics into the league bundle.

### AI Evidence Group

- `/predictions/predictability/leagues/{leagueId}`
- `/predictions/probabilities/fixtures/{fixtureId}` when fixture enrichment lacks predictions.
- `/predictions/value-bets/fixtures/{fixtureId}` when fixture enrichment lacks value-bet evidence and the subscription allows it.
- `/match-facts/leagues/{leagueId}`

Provider predictions and value bets remain raw baseline evidence only. They are not labels, recommendations, or local prediction output.

Team-level xG is satisfied by `xGFixture` in the fixture enrichment payload. The runner does not finish the global `/expected/fixtures` feed and does not call `/expected/lineups`.

## Deduplication And Resume

### Exact Request Identity

Every request uses a stable identity built from:

```text
provider + endpointKey + urlPath + normalized query without api_token
```

Query keys are sorted before hashing. The token is never persisted.

### Skip Conditions

An exact request is skipped only when:

- a manifest entry has `status: captured`;
- its raw envelope exists;
- the envelope payload hash matches;
- a non-paginated request has a complete payload; or
- a paginated request has a terminal page with `hasMore: false`.

If the manifest exists but the raw envelope is missing or corrupt, the request is fetched again.

### Pagination Resume

Incomplete paginated requests resume from the latest captured cursor or next page. They do not restart at page 1. Completed pages are not fetched again.

### Semantic Coverage

Exact HTTP deduplication does not imply that the same provider entity cannot appear in raw payloads from two different endpoints. The runner reduces semantic overlap by applying these rules:

- A terminal global capture can satisfy an equivalent entity lookup.
- Existing fixture enrichment can satisfy odds, predictions, xG, news, referee, venue, and commentary coverage when those fields are present.
- Missing fields trigger only the narrower fixture endpoint.
- Incomplete global transfers, rankings, or odds do not prove league coverage; the runner uses scoped endpoints for completeness.

Provider-neutral warehouse normalization remains responsible for entity-level deduplication by provider entity ID and provenance.

## Execution And Failure Handling

- Process groups in this order: season, fixture, team, ai.
- Respect the existing client rate limit.
- Stop cleanly on rate limiting and record the resumable request.
- Continue after endpoint-level `403` or `404` as `unavailable`.
- Stop with a non-zero exit code when unexpected failures occur.
- Enforce `--max-requests` before issuing the next request.
- Never enable live or in-play endpoints through this command.

## Report

Write a report under:

```text
apps/api/data/providers/sportmonks/reports/league-<leagueId>-capture-<timestamp>.json
```

The report contains:

- league ID and selected season IDs;
- discovered fixture, team, and team-season counts;
- requests skipped, resumed, captured, unavailable, and failed;
- coverage by season, fixture, team, and AI group;
- missing global references;
- rate-limit or request-budget stop reason;
- endpoints excluded by design.

## Testing Strategy

Implementation must follow TDD with focused tests for:

- league inventory extraction and season selection;
- exact request identity normalization;
- valid raw-envelope skip and missing-envelope recapture;
- pagination resume without page-one duplication;
- request graph construction for one league, season, team, and fixture;
- league filtering on team season statistics;
- fixture-field coverage suppressing redundant odds/prediction/xG calls;
- group filtering and request budget stops;
- explicit exclusion of live, in-play, global-all, and `expected.lineups` endpoints;
- CLI argument parsing and actionable missing-inventory failures.

## Success Criteria

- `pnpm run data:capture:sportmonks:league -- --league-id=8` captures only data related to league 8 and its discovered teams, fixtures, and seasons, except bounded team-history endpoints.
- Existing valid terminal requests are not fetched again.
- Incomplete requests resume rather than restart.
- No live, in-play, or expected-lineup endpoint is called.
- Existing provider-neutral raw cache and manifest formats remain valid.
- Focused tests, typecheck, and `pnpm run verify:local` pass.

## Sources

- Sportmonks endpoints overview: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints
- Pre-match odds by fixture: https://docs.sportmonks.com/v3/odds-api/getting-started/endpoints/pre-match-odds
- Transfers by team: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/transfers/get-transfers-by-team-id
- Team rankings by team: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/team-rankings-beta/get-team-rankings-by-team-id
- Match facts by league: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/match-facts-beta/get-match-facts-by-league-id
- Predictability by league: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/predictions/get-predictability-by-league-id
- Referees by season: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/referees/get-referees-by-season-id
- Venues by season: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/venues/get-venues-by-season-id
- Team squad by team and season: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/team-squads/get-team-squad-by-team-and-season-id
- Season statistics by participant: https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/statistics/get-season-statistics-by-participant
