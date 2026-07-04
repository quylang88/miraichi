# Phase 9 Non-AI App Completion, Local Data API, Cloud Persistence, and Release Readiness Plan

## Status
- **Status**: Active phase plan
- **Date**: 2026-07-01
- **Lifecycle command**: `phase:plan Phase 9 Non-AI App Completion, Local Data API, Cloud Persistence, and Release Readiness`
- **Owner direction**: The owner explicitly redirected the roadmap on 2026-07-01 to complete the four non-AI tabs first, remove API-Football free-tier usage, and defer Miraichi AI training/runtime to the final phase.

## Straight Conclusion
Phase 9 must stop treating model training as the next priority. The app needs to become usable first.

The immediate target is not a better model. The immediate target is a working product shell:

- `Today`
- `Matches`
- `Bets`
- `Bankroll`
- cloud persistence for the user-owned data
- local/manual football match data for finished and scheduled fixtures
- `Miraichi AI` disabled or honest-unavailable until the final AI phase

## Why This Change Is Necessary
The previous active roadmap had drifted into Phase 8 training/data-provider work while the user-facing product was still incomplete. That is the wrong order.

A trained model does not matter if:

- the non-AI tabs are not complete;
- bankroll/capital records are not reliably persisted;
- the cloud database path is not selected and verified;
- match data still depends on API-Football free-tier quota;
- the app cannot pass an end-to-end staging smoke check.

Phase 9 fixes that product foundation before returning to AI.

## Source Facts Checked On 2026-07-01
The data-source decision must be honest:

- SofaScore states that it cannot share sports data as API endpoints because of provider agreements: <https://sofascore.helpscoutdocs.com/article/129-sports-data-api-availability>
- `soccerdata` documents itself as a collection of scrapers, including SofaScore, FBref, ESPN, Football-Data.co.uk, Understat, and WhoScored: <https://soccerdata.readthedocs.io/en/latest/>
- OpenFootball provides public-domain World Cup structured data, including World Cup 2026 fixtures and prior tournaments: <https://github.com/openfootball/worldcup>
- OpenFootball provides public-domain Euro structured data, including Euro 2024 and historical editions: <https://github.com/openfootball/euro>
- football-data.org free plan includes delayed scores, fixtures, schedules, league tables, 12 competitions, and 10 calls/minute; its free coverage includes FIFA World Cup and European Championship: <https://www.football-data.org/pricing> and <https://www.football-data.org/coverage>
- The `international_results` dataset reports 49,459 men's full international match results from 1872 through 2024, but it is finished-results history, not future fixtures: <https://github.com/martj42/international_results>
- Existing Miraichi Phase 8.6B/8.6C evidence already discovered and ingested SofaScore national-team data for seven competitions, but bookmaker odds remained unavailable.

## Data Source Decision For Phase 9
### Approved Removal
API-Football free-tier usage is removed from the active roadmap.

Phase 9 must remove:

- API-Football environment assumptions such as `API_FOOTBALL_KEY`;
- API-Football-specific source IDs in active API responses;
- API-Football provider tests as the current expected path;
- API-Football snapshot-store plans;
- any documentation that presents API-Football free tier as the future live/match data source.

Historical completed work may remain in git history and old reports, but it is not a valid future dependency.

### Recommended Source Order
1. **OpenFootball mirror first** for World Cup and Euro seed data.
   - Best fit for World Cup/Euro because it is open, structured, and easy to mirror locally.
   - It should seed World Cup 2026 scheduled fixtures first, then Euro latest/past, then historical backfill.
2. **Existing SofaScore local ingestion second** for richer and broader national-team coverage.
   - Use only as a local/manual scraper-backed enrichment source.
   - Do not call it an official API.
   - Cache raw responses and allow graceful failure.
3. **football-data.org optional verification source** for World Cup/Euro fixtures and delayed scores.
   - This is allowed only if the owner approves a key and rate-limit policy.
   - It is not API-Football and must not become required for the app to work.
4. **international_results historical baseline** for finished national-team results.
   - Useful for deep history and sanity checks.
   - Not useful for upcoming fixtures.

### Practical Local API Shape
Phase 9 should create an owner-controlled local data API that serves from a provider-neutral serving store built from canonical warehouse, not from live third-party fetches and not from a single `national-team-matches.json` file:

- `GET /api/v1/matches?date=YYYY-MM-DD`
- `GET /api/v1/matches?competitionId=...&status=scheduled|finished`
- `GET /api/v1/matches/:id`
- `GET /api/v1/data-snapshot/status`
- normalize command: `pnpm run data:normalize:sportmonks:warehouse`
- build command: `pnpm run data:build:serving:matches`

The canonical-to-serving build path should prioritize:

1. World Cup 2026 scheduled/finished fixtures.
2. Euro latest available edition and future official schedule when available.
3. World Cup historical backfill.
4. Euro historical backfill.
5. Other national-team competitions only after the four non-AI tabs are stable.

No live polling is part of Phase 9.

The removed path is explicit: do not recreate `apps/api/data/local-match-snapshots/`, `national-team-matches.seed.json`, `national-team-matches.json`, or `scripts/update-national-team-data.ts`.

## Phase 9 Scope
### In Scope
- Remove API-Football from active app data flow.
- Replace app match feed with serving-store-backed API.
- Keep source adapters replaceable.
- Complete `Today` and `Matches` against real serving-store data states.
- Complete `Bets` as user-entered records and draft/history workflows.
- Complete `Bankroll` as owner-entered capital ledger/account records.
- Add cloud database persistence after a provider ADR is approved.
- Preserve offline fallback/import/export where practical.
- Run local, integration, staging verification before closeout.

### Out Of Scope
- Miraichi AI chat/prediction UX beyond disabled or unavailable state.
- Model training.
- Runtime prediction routes.
- Betting recommendation labels.
- Stake sizing, Kelly, ROI, CLV, yield, or bankroll advice formulas.
- Odds provider integration.
- Live scores or live polling.
- Club competition expansion.
- Production launch without staging evidence and explicit owner approval.

## Phase 9 Subphases
### Phase 9.0: Roadmap Reset And Provider Supersession
Goal: make the plan honest and stop the active API-Football path.

Deliverables:
- `PROJECT_PLAN.md` updated.
- ADR-0035 marked superseded for the API-Football free-tier path.
- ADR-0042 added for local/manual data API and API-Football removal.
- Phase 8.6F API-Football snapshot-store plan marked canceled or superseded.

### Phase 9.1: API-Football Removal And Local Data API Implementation Plan
Goal: create exact TDD slices before code changes.

Required implementation-plan slices:
- remove API-Football provider module usage from active API routes;
- replace tests with serving-store provider-neutral expectations;
- keep the app contract provider-neutral and light;
- add serving match store repository;
- add route handlers for list/detail/status;
- update web match-feed service expected states;
- verify no API-Football env var is required.

### Phase 9.2: Manual National-Team Data Update Pipeline
Goal: make finished and scheduled fixtures updateable by the owner once per day.

Required implementation-plan slices:
- source registry for OpenFootball, SofaScore local ingestion, optional football-data.org, and historical-results baseline;
- mirror/import command for raw/canonical World Cup and Euro data;
- canonical warehouse writer with provenance metadata;
- serving-store builder from canonical warehouse;
- freshness/staleness status report;
- safe failure output when a source is unavailable;
- World Cup 2026 first queue;
- Euro latest/past queue.

### Phase 9.3: Cloud Database Provider ADR And Persistence Plan
Goal: select the cloud database boundary before writing production persistence.

Owner decision required:
- Which cloud database provider and auth boundary are approved?

Recommended answer:
- Choose one managed Postgres-compatible cloud database path through an ADR, then implement only the minimum tables needed for user-owned app state and serving-store match sync.

Reason:
- A vague "cloud database" requirement is not implementable. Without a provider and auth boundary, agents will either fake persistence or hardcode the wrong infrastructure.

Risk if skipped:
- Data loss, untestable sync, insecure credentials, and a fake app that only works locally.

### Phase 9.4: Four Non-AI Tabs Feature Completion
Goal: complete the app the owner can actually use.

Required completion targets:
- `Today`: daily match list, match status, stale-data banner, empty state, date navigation.
- `Matches`: competition/date filters, match detail, scheduled/finished grouping, source provenance.
- `Bets`: add/edit/delete owner-entered bet records, draft persistence, history view, no automated recommendation.
- `Bankroll`: account/ledger/capital records, deposit/withdrawal/manual adjustments, backup/export, no automated risk or stake formulas.

### Phase 9.5: Integration, Staging, And Closeout
Goal: prove the app works across boundaries.

Required evidence:
- `pnpm run verify:local`
- `pnpm run test:integration`
- `pnpm run verify:staging`
- staging smoke evidence for all four non-AI tabs
- explicit unavailable state for `Miraichi AI`
- known risks and owner decisions remaining before Phase 10

## Exit Criteria
Phase 9 can close only when:

1. The app no longer requires API-Football free-tier credentials or API-Football route behavior.
2. Canonical warehouse data can be materialized into the serving store and served through the API.
3. World Cup 2026 is the first scheduled/finished fixture target.
4. Euro latest/past backfill has a working path.
5. `Today`, `Matches`, `Bets`, and `Bankroll` operate against persisted data.
6. Cloud persistence has an owner-approved provider ADR and passing verification.
7. `Miraichi AI` is visibly disabled or unavailable, not fake-functional.
8. Local, integration, and staging verification pass.
9. The phase closeout recommends Phase 10 only if the owner explicitly approves returning to AI.

## Owner Decisions Still Needed
| Decision | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| Should API-Football free tier stay anywhere in the active app path? | No. Remove it completely from active Phase 9 implementation. | Owner rejected it and quota limits make it a bad foundation. | The app remains fragile and tied to a source the owner already rejected. |
| Should SofaScore be treated as an official API? | No. Treat it as local-only scraper-backed enrichment. | SofaScore says API endpoints are not available for sharing. | Legal/terms risk and broken assumptions when endpoints change. |
| Should the app require football-data.org? | No. Keep it optional unless the owner approves key usage. | Canonical warehouse plus serving store should keep the app usable without another API dependency. | Another key/quota dependency replaces the API-Football problem. |
| What cloud database should Phase 9 implement? | Approve one provider in an ADR before code. | Persistence is guardrail-sensitive and cannot be guessed safely. | Wrong schema, wrong auth model, or data-loss-prone sync. |
| Should bankroll calculate stakes/risk automatically now? | No. Manual ledger/account records only. | Stake/risk math is explicitly blocked without owner-approved formulas. | Accidental betting advice and false financial confidence. |

## Recommended Next Lifecycle Command
`phase:implementation-plan Phase 9 API-Football Removal and Local Data API`

Do not start code slices until that implementation plan names exact files, failing tests, implementation steps, and verification commands.
