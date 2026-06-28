# ADR-0035: Real Data Provider Selection and Integration Strategy

* **Status**: Draft - Owner Review Required
* **Date**: 2026-06-28
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started
* **Source Candidate**: [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md)
* **Note**: This draft does not select a production vendor, approve paid billing, add credentials, or authorize live provider code.

---

## 1. Context
Miraichi needs real football fixture, result, statistics, lineup, and odds data for future dataset construction and model evaluation.

Phase 3 accepted a provider adapter boundary without selecting a real provider. Phase 7 may now draft a real provider selection strategy, but final provider approval remains owner-controlled under [OWNER-DECISION-GATES.md](file:///c:/CODE/miraichi/docs/governance/OWNER-DECISION-GATES.md).

## 2. Options Considered
* **Option A**: Direct scraping/parsing of bookmaker sites and sports directories.
* **Option B (Draft Recommended)**: Use API-Football as the primary development provider candidate behind a replaceable adapter.
* **Option C**: Combine alternative APIs such as Football-Data.org for fixtures and The Odds API for odds.

## 3. Draft Recommendation
Recommend **Option B as a draft development-provider direction only**.

API-Football appears to be the best first candidate because it can potentially cover fixture metadata and odds under one API, reducing cross-provider ID matching. The owner must recheck current pricing, quota, coverage, and terms before acceptance:

* API-Football pricing: [https://www.api-football.com/pricing](https://www.api-football.com/pricing)
* API-Football coverage: [https://www.api-football.com/coverage](https://www.api-football.com/coverage)
* Football-Data.org pricing: [https://www.football-data.org/pricing](https://www.football-data.org/pricing)
* The Odds API pricing: [https://the-odds-api.com/](https://the-odds-api.com/)

This recommendation is not a production provider selection. It only prepares the project to draft an implementation plan after owner approval.

## 4. Owner Decisions Required
| Question | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
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

## 7. Explicit Exclusions
* No production provider is accepted by this draft.
* No API key, credential, `.env`, secret, or paid subscription is approved.
* No live HTTP client, poller, scraper, or ingestion job is approved.
* No production database, schema, or provider credential storage is approved.

## 8. Draft Readiness
This ADR can move to owner review as a draft. It should not be accepted until the owner confirms provider source facts and explicitly approves the provider strategy.
