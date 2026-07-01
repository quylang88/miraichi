# ADR-0035: Real Data Provider Selection and Integration Strategy

* **Status**: Superseded
* **Date**: 2026-06-28
* **Accepted Date**: 2026-06-28
* **Superseded Date**: 2026-07-01
* **Superseded By**: [ADR-0042: Local Manual Data API and API-Football Free-Tier Removal](file:///c:/CODE/miraichi/docs/decisions/ADR-0042-local-data-api-and-api-football-removal.md)
* **Owner Approval Required**: Yes
* **Owner Approval**: Approved by project owner
* **Implementation Status**: Superseded before production implementation
* **Source Candidate**: [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md)
* **Note**: This ADR is retained as historical Phase 7 planning context only. Its API-Football free-tier direction is no longer active after the owner's 2026-07-01 roadmap reset.

---

## 1. Context
Miraichi needs real football fixture, result, statistics, lineup, and odds data for future dataset construction and model evaluation.

Phase 3 accepted a provider adapter boundary without selecting a real provider. Phase 7 select a real provider selection strategy, but final provider approval remains owner-controlled under [OWNER-DECISION-GATES.md](file:///c:/CODE/miraichi/docs/governance/OWNER-DECISION-GATES.md).

## Supersession Notice
On 2026-07-01, the owner explicitly rejected continuing with API-Football free-tier usage and redirected the roadmap toward a local/manual snapshot API before any further AI training/runtime work.

Do not use this ADR to justify:

* API-Football free-tier dependencies;
* `API_FOOTBALL_KEY` requirements;
* API-Football snapshot stores;
* live polling;
* public match-data traffic;
* model training/runtime work before the non-AI app is complete.

Use ADR-0042 for the active Phase 9 data-provider direction.

## 2. Options Considered
* **Option A**: Direct scraping/parsing of bookmaker sites and sports directories.
* **Option B**: Use API-Football as the primary owner-only free-tier development provider candidate behind a replaceable adapter.
* **Option C**: Use Football-Data.org as a fixture/results fallback and The Odds API as an odds-only fallback or supplement.
* **Option D (Accepted)**: Hybrid Ingestion Strategy (Offline Historical Scraping via `soccerdata` + Online Live/Matchday Free APIs).

## 3. Decision
Accept **Option D as the most optimal, 100% free solution for a single-user pilot**.

### Why Option D is the Optimal Choice:
1. **Historical Scaling (Free & Unlimited)**: Training prediction models requires years of historical data across multiple leagues. Doing this via API-Football's free tier (100 requests/day) is impossible. Option D uses `soccerdata` (FBref, Understat, Football-Data.co.uk) locally on the owner's machine to generate bulk offline historical datasets instantly and for free, without API quota constraints.
2. **Live Data & Odds (Within Free Limits)**: Live data is polled from API-Football's free tier (100 requests/day) and current odds from The Odds API (500 requests/month). Because this is only for today's matches for a single user, we stay well within the limits by using low-frequency client-initiated updates or smart caching.
3. **Architecture Integration**: The Python-based `soccerdata` scraper runs as an offline CLI utility/script inside the `apps/local-ai` environment or as local data prep scripts, exporting standardized JSON datasets. This avoids running Python in production workers or the web client, preserving the monorepo's TypeScript boundary.

This is not a public-product choice. The accepted implementation plan should start with:
* One project-owner user only;
* Free tier API keys only;
* Local raw response cache (IndexedDB on client, SQLite/filesystem on local server/worker);
* Throttled daily and monthly quota guards;
* Manual/client-driven updates instead of high-frequency automatic cron pollers;
* A team/league name mapping dictionary to resolve spelling differences between scraping sources and APIs.

Current source facts and review notes:

| Provider / Tool | Current Free-Tier Usefulness | Recommendation |
| --- | --- | --- |
| **soccerdata** (Python Lib) | Scraping from FBref, Understat, Sofascore, ESPN. Excellent for bulk historical match stats, standings, and xG. No API keys needed. | **Primary Historical Source**: Run locally to generate training datasets without API limit bottlenecks. |
| API-Football | Historical Phase 7 candidate only. The free-tier path was rejected by the owner on 2026-07-01. | **Superseded**: Do not use as primary, fallback, staging, or roadmap dependency. Use ADR-0042 instead. |
| The Odds API | 500 requests/month free tier. Good for pre-match and live bookmaker odds. | **Primary Odds Supplement**: Poll once/twice a day per matchday to conserve quota. |
| Football-Data.org | 12 competitions free, delayed fixtures/results, 10 calls/minute. | Fixture fallback if API-Football is unavailable. |

The owner must recheck current pricing, quota, coverage, and terms before acceptance:
* API-Football pricing: [https://www.api-football.com/pricing](https://www.api-football.com/pricing)
* API-Football coverage: [https://www.api-football.com/coverage](https://www.api-football.com/coverage)
* The Odds API pricing: [https://the-odds-api.com/](https://the-odds-api.com/)
* SoccerData documentation: [https://soccerdata.readthedocs.io/](https://soccerdata.readthedocs.io/)

This decision is not a production provider selection. It only prepares the project to draft an implementation plan after owner approval.

## 4. Owner Decisions Required
| Question | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| What initial usage scope is approved? | One project owner only, free tier only, no public users. | Free quotas are too small and unstable for public traffic. Owner-only scope allows learning without cost exposure. | Public or multi-user usage will exhaust quota, produce incomplete datasets, or force accidental paid migration. |
| Which data ingestion strategy should be tried first? | **Option D (Hybrid)**: Scraping (`soccerdata`) for history/training data; free APIs (API-Football + The Odds API) for matchday live scores and odds. | Combines the best of both: unlimited historical scaling for training, and lightweight official APIs for live data without IP ban risks. | Relying only on APIs blocks historical backfilling. Relying only on scraping for live data risks frequent IP bans/Cloudflare blocks. |
| How should team name variations be handled? | A local name mapping dictionary (`packages/shared/src/data/team-mappings.json`). | Different sources spell team names differently (e.g. "Manchester United" vs "Man United"). Joining data requires a standardized dictionary. | Joining datasets on raw names will result in missing matches and corrupted datasets. |
| How should bulk historical ingestion handle concurrency limits? | Use a throttled queue, raw cache, resumable batch checkpoints, and provider-specific rate-limit config. | This respects provider quotas/scraping guidelines and makes retries deterministic. | Aggressive concurrent fetches risk rate-limit bans and incomplete datasets. |
| Do the current provider assumptions still hold? | Owner must recheck official pricing, coverage, and terms on the acceptance date and record the checked source URLs. | Provider pricing and coverage are unstable facts. | Accepting stale provider claims can select the wrong vendor or create hidden cost exposure. |

## 5. Consequences
* Keeps provider choice replaceable through the adapter boundary.
* Allows a future implementation plan to build cache, throttling, and parser slices.
* Avoids cross-provider ID joining in the live path, while introducing a local dictionary for mapping historical scraping IDs to live API IDs.
* Integrates Python-based historical scrapers cleanly as an offline data-prep step without polluting the Node.js/TypeScript runtime.

## 6. Risks
* Web scraping is fragile; layout changes on FBref/Understat can break `soccerdata` parsers.
* FBref and Understat have aggressive rate limits; we must run `soccerdata` with built-in delays (e.g. 3-5 seconds between requests) to avoid IP bans.
* Combining historical data with live APIs requires maintaining a team and competition ID map, which has minor overhead.
* Live API free tiers can be exhausted if the user polls too frequently.

## 7. Explicit Exclusions
* No API key, credential, `.env`, secret, or paid subscription is approved.
* No live HTTP client, poller, scraper, or ingestion job is approved.
* No production database, schema, or provider credential storage is approved.
* No public users, multi-user rollout, paid plan, or traffic scaling is approved.

## 8. Acceptance Notes
Accepted by the project owner on 2026-06-28 as a Phase 7 planning boundary only. This decision authorizes the hybrid ingestion strategy for development, not live provider integration, paid subscriptions, or production promotion.
