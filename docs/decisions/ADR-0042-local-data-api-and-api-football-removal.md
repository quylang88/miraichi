# ADR-0042: Local Manual Data API and API-Football Free-Tier Removal

* **Status**: Accepted
* **Date**: 2026-07-01
* **Accepted Date**: 2026-07-01
* **Owner Approval Required**: Yes
* **Owner Approval**: Approved by direct owner instruction in chat on 2026-07-01
* **Implementation Status**: Planned for Phase 9
* **Supersedes**: API-Football free-tier portions of [ADR-0035](file:///c:/CODE/miraichi/docs/decisions/ADR-0035-real-data-provider-selection-and-integration-strategy.md), Phase 8.6E active provider direction, and Phase 8.6F API-Football snapshot-store direction

---

## 1. Context
The active roadmap drifted into model-training and API-Football-backed app data work before the four non-AI tabs were complete.

The owner redirected the roadmap on 2026-07-01:

1. Pause/defer Phase 8/AI training/API work.
2. Complete the app first, excluding the `Miraichi AI` tab.
3. Make `Today`, `Matches`, `Bets`, and `Bankroll` work smoothly.
4. Make capital-management and cloud database persistence work.
5. Stop using API-Football free tier completely.
6. Investigate a local API fed by manual daily updates for finished and scheduled fixtures only.
7. Prioritize national teams, especially World Cup and Euro, starting with World Cup 2026.

This ADR records the provider and data-flow reset needed before Phase 9 implementation planning.

## 2. Source Facts Checked
The current source facts do not support API-Football free tier as the next foundation:

- SofaScore says it cannot share sports data in the form of API endpoints because of provider agreements: <https://sofascore.helpscoutdocs.com/article/129-sports-data-api-availability>
- `soccerdata` is a scraper toolkit that includes SofaScore, FBref, ESPN, Football-Data.co.uk, Understat, and WhoScored: <https://soccerdata.readthedocs.io/en/latest/>
- OpenFootball provides public-domain World Cup data, including World Cup 2026 and prior tournaments: <https://github.com/openfootball/worldcup>
- OpenFootball provides public-domain Euro data, including Euro 2024 and historical editions: <https://github.com/openfootball/euro>
- football-data.org free plan includes delayed scores, fixtures, schedules, 12 competitions, and 10 calls/minute; free coverage includes FIFA World Cup and European Championship: <https://www.football-data.org/pricing> and <https://www.football-data.org/coverage>
- `international_results` reports 49,459 men's full international match results from 1872 through 2024, but does not provide future fixtures: <https://github.com/martj42/international_results>

## 3. Decision
Use an owner-controlled local/manual snapshot data API for Phase 9.

API-Football free tier is no longer an active provider, fallback, staging dependency, or future roadmap dependency.

Phase 9 data must be served from local/cloud snapshots controlled by Miraichi, not live third-party API calls:

- raw source imports happen through manual owner-triggered commands;
- app API routes read normalized snapshots;
- source provenance and freshness are explicit;
- failures are shown as stale/unavailable states, not hidden;
- no live polling is approved.

## 4. Approved Source Priority
### 4.1 Primary Seed Source: OpenFootball
OpenFootball is the preferred first source for World Cup and Euro seed data because it is open, structured, and local-mirror friendly.

Priority:

1. World Cup 2026 scheduled fixtures.
2. World Cup finished fixtures as they become available.
3. Euro latest completed edition.
4. World Cup historical backfill.
5. Euro historical backfill.

### 4.2 Enrichment Source: SofaScore Local Scraper Path
SofaScore may be used only as local/manual scraper-backed enrichment.

Restrictions:

- Do not call SofaScore an official API.
- Do not put SofaScore browser/API endpoints directly in client code.
- Do not use SofaScore as a production contract.
- Cache raw responses.
- Fail gracefully when endpoints change or are blocked.

Existing Phase 8.6B/8.6C evidence remains useful for national-team coverage, but it is not proof of a stable licensed API.

### 4.3 Optional Verification Source: football-data.org
football-data.org may be used only as an optional verification or fallback source if the owner approves key usage and rate-limit policy.

It must not become mandatory for the app to work.

### 4.4 Historical Baseline: international_results
The `international_results` dataset may be used for deep historical finished-match sanity checks, not future fixture scheduling.

## 5. Required Phase 9 Architecture
Phase 9 should implement:

- a source registry for local/manual imports;
- normalized match snapshot contracts;
- local/cloud snapshot storage;
- a manual daily update command;
- route handlers for match list, match detail, and snapshot status;
- stale-data indicators in the web shell;
- no dependency on `API_FOOTBALL_KEY`;
- no API-Football provider ID in active normalized responses.

Proposed API surface:

- `GET /api/v1/matches?date=YYYY-MM-DD`
- `GET /api/v1/matches?competitionId=...&status=scheduled|finished`
- `GET /api/v1/matches/:id`
- `GET /api/v1/data-snapshot/status`

## 6. Cloud Database Boundary
This ADR does not select a cloud database provider.

Phase 9 must create and accept a separate cloud database provider ADR before implementing production cloud persistence.

Minimum accepted direction:

- use one owner-approved cloud database provider;
- store only user-owned app data and normalized match snapshots needed by the four non-AI tabs;
- keep secrets out of the browser;
- preserve export/import or backup evidence;
- verify with integration and staging smoke checks.

## 7. Consequences
Positive:

- Removes API-Football quota and key dependence.
- Makes daily manual update acceptable for the owner's current workflow.
- Keeps the app usable without live data.
- Keeps national-team-first focus.
- Makes source provenance and staleness visible.

Negative:

- Manual updates require discipline.
- SofaScore enrichment can break because it is scraper-based.
- OpenFootball may not include every field the app eventually wants.
- football-data.org remains keyed and delayed if used.
- Cloud persistence still requires a provider ADR before implementation.

## 8. Explicit Non-Authorizations
This ADR does not approve:

- model training;
- `Miraichi AI` runtime;
- public prediction surfaces;
- odds ingestion;
- live polling;
- club competitions;
- stake sizing, Kelly, ROI, CLV, yield, or bankroll advice;
- production launch;
- cloud database implementation before a provider ADR;
- hardcoded World Cup-only logic in core routes or contracts.

## 9. Owner Decisions Recorded
| Question | Decision | Reason | Risk If Reversed |
| --- | --- | --- | --- |
| Should API-Football free tier remain in active roadmap? | No. Remove it completely. | Owner rejected it and quota limits make it a bad base. | The app stays fragile and blocked by a rejected provider. |
| Should training AI remain the next phase? | No. Defer it to the final AI phase. | The app is not usable enough yet. | The project optimizes an AI layer before product workflows work. |
| Should data be live now? | No. Finished and scheduled fixtures only, manually updated daily. | This matches current owner workflow and avoids live-data complexity. | Live polling adds fragility, quota, and release risk. |
| Should national teams come first? | Yes. World Cup and Euro first, with World Cup 2026 prioritized. | This matches existing guardrails and owner direction. | Scope spreads into club competitions before the app is stable. |

## 10. Implementation Handoff
Recommended next lifecycle command:

`phase:implementation-plan Phase 9 API-Football Removal and Local Data API`

That implementation plan must use TDD slices and exact verification commands before any code changes.
