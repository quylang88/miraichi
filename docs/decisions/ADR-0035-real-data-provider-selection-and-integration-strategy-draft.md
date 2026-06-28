# ADR-0035: Real Data Provider Selection and Integration Strategy

* **Status**: Draft - Owner Review Required
* **Date**: 2026-06-28
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started
* **Source Candidate**: [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md)
* **Note**: This draft does not select a production vendor, approve paid billing, add credentials, authorize live provider code, or authorize public/multi-user rollout.

---

## 1. Context
Miraichi needs real football fixture, result, statistics, lineup, and odds data for future dataset construction and model evaluation.

Phase 3 accepted a provider adapter boundary without selecting a real provider. Phase 7 may now draft a real provider selection strategy, but final provider approval remains owner-controlled under [OWNER-DECISION-GATES.md](file:///c:/CODE/miraichi/docs/governance/OWNER-DECISION-GATES.md).

## 2. Options Considered
* **Option A**: Direct scraping/parsing of bookmaker sites and sports directories.
* **Option B (Draft Recommended)**: Use API-Football as the primary owner-only free-tier development provider candidate behind a replaceable adapter.
* **Option C**: Use Football-Data.org as a fixture/results fallback and The Odds API as an odds-only fallback or supplement.

## 3. Draft Recommendation
Recommend **Option B as a draft owner-only, free-first development-provider direction only**.

API-Football remains the best first candidate if the owner confirms its current free tier covers enough football fixtures, statistics, lineups, and odds endpoints for a one-person pilot. The practical reason is simple: a single provider reduces cross-provider match/team ID joins, which are a real source of bad data.

This is not a public-product choice. The accepted implementation plan, if this ADR is later accepted, should start with:

* one project-owner user only;
* free tier only;
* local raw response cache;
* daily and monthly quota guards;
* low-frequency manual or scheduled pulls;
* no paid plan, public users, or multi-user scaling without separate owner approval.

Current source facts and review notes:

| Provider | Current Free-Tier Usefulness | Recommendation |
| --- | --- | --- |
| API-Football | Broadest candidate if the owner confirms the current free tier, quota, endpoint coverage, and terms. The official pricing/coverage pages must be rechecked on the acceptance date. | Primary candidate for owner-only free pilot, because it may avoid cross-provider joins. Do not accept until owner confirms the live source facts. |
| Football-Data.org | Official pricing page currently shows a free plan with 12 competitions, delayed scores/schedules, fixtures, league tables, and 10 calls/minute. | Good fixture/results fallback, weak as the only provider for prediction work because odds and richer stats are limited or add-on based. |
| The Odds API | Official homepage currently shows a free Starter plan with 500 credits/month, all sports, most bookmakers, all betting markets, and no historical odds. | Good odds-only supplement, not a complete football data provider by itself. |

The owner must recheck current pricing, quota, coverage, and terms before acceptance:

* API-Football pricing: [https://www.api-football.com/pricing](https://www.api-football.com/pricing)
* API-Football coverage: [https://www.api-football.com/coverage](https://www.api-football.com/coverage)
* Football-Data.org pricing: [https://www.football-data.org/pricing](https://www.football-data.org/pricing)
* The Odds API pricing: [https://the-odds-api.com/](https://the-odds-api.com/)

This recommendation is not a production provider selection. It only prepares the project to draft an implementation plan after owner approval.

## 4. Owner Decisions Required
| Question | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| What initial usage scope is approved? | One project owner only, free tier only, no public users. | Free quotas are too small and unstable for public traffic. Owner-only scope allows learning without cost exposure. | Public or multi-user usage will exhaust quota, produce incomplete datasets, or force accidental paid migration. |
| Which free provider should be tried first? | API-Football, if owner confirms current free-tier terms and endpoint coverage. Otherwise, use Football-Data.org for fixtures/results and The Odds API for odds as separate fallback feeds. | One broad provider is simpler and safer than joining IDs across vendors. | Starting with multiple providers too early increases mapping errors and review cost. |
| How should Miraichi transition from free tier to paid tier? | Keep provider limits and plan tier outside core code, behind configuration and adapter metadata. Paid tier requires a separate owner approval. | Avoids rewriting adapter logic when plan limits change. | Hardcoding free-tier assumptions will break ingestion as soon as usage grows. |
| How should bulk historical ingestion handle concurrency limits? | Use a throttled queue, raw cache, resumable batch checkpoints, and provider-specific rate-limit config. | This respects provider quotas and makes retries deterministic. | Aggressive concurrent fetches risk rate-limit bans and incomplete datasets. |
| Do the current provider assumptions still hold? | Owner must recheck official pricing, coverage, and terms on the acceptance date and record the checked source URLs. | Provider pricing and coverage are unstable facts. | Accepting stale provider claims can select the wrong vendor or create hidden cost exposure. |

## 5. Consequences
* Keeps provider choice replaceable through the adapter boundary.
* Allows a future implementation plan to build cache, throttling, and parser slices.
* Avoids cross-provider ID joining in the first draft path if API-Football is accepted.

## 6. Risks
* Provider coverage, pricing, and terms can change.
* API schema changes can break parsers.
* Relying on a single provider could create vendor lock-in if the adapter boundary is weak.
* Free tiers can be too small for backfills, live refreshes, or multi-market experiments.
* Combining fixture and odds providers later may require explicit team, competition, match, and market ID reconciliation.

## 7. Explicit Exclusions
* No production provider is accepted by this draft.
* No API key, credential, `.env`, secret, or paid subscription is approved.
* No live HTTP client, poller, scraper, or ingestion job is approved.
* No production database, schema, or provider credential storage is approved.
* No public users, multi-user rollout, paid plan, or traffic scaling is approved.

## 8. Draft Readiness
This ADR can move to owner review as a draft. It should not be accepted until the owner confirms provider source facts and explicitly approves the provider strategy.
