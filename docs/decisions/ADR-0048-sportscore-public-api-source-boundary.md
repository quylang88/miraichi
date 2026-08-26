# ADR-0048: SportScore Public API Source Boundary

- **Status**: Accepted
- **Date**: 2026-08-26
- **Owner approval**: The owner explicitly approved the SportScore public API direction, visible `Powered by SportScore` attribution, local secret handling, immediate planning, and complete removal of the API-Football implementation on 2026-08-26.
- **Supersedes**: ADR-0047 and the external-source portion of ADR-0045.

## Context

The API-Football Free plan was proven unsuitable for Miraichi's current-season fixture and result workflow: the contained staging smoke consumed one authorized request and the provider rejected the current season. A nominal request allowance is useless when the required seasons are outside the entitlement.

SportScore publishes a free JSON API for football fixtures, results, and match detail. Its developer terms currently permit personal, hobby, open-source, community, and early-stage attributed use, subject to a visible dofollow SportScore attribution link. Anonymous access is allowed; a free registered key is optional and raises the rate limit. The free service has no SLA, responses are edge-cached, and bulk raw-feed redistribution is forbidden. There is one unresolved documentation inconsistency: the API terms describe the free tier as endpoints under `/api/widget/`, while the official OpenAPI marks `/api/v1/fixtures/` as anonymously accessible. The latter endpoint is the one that supplies the required date/competition filtering.

Direct observations made during source validation on 2026-08-26 found all 50 target competitions in SportScore's public competition directory and returned current/future fixtures plus finished results. A sampled finished match detail returned score breakdown, goal/card/substitution events, and lineups, but team statistics were not consistently populated. Anonymous calls also intermittently returned HTTP 503.

## Decision

1. **Source and legal boundary**
   - SportScore Public API is the only approved external match-data source for the next implementation phase.
   - Use only documented public API endpoints. Do not scrape SportScore HTML pages, use private endpoints, evade rate limits, or mirror raw responses as a public data feed.
   - Local code may target the documented `/api/v1/fixtures/` contract behind mocks, but a real staging or production call to `/api/v1` requires the terms page to cover it unambiguously or written confirmation from SportScore. OpenAPI discoverability alone is not treated as legal certainty.
   - Cache normalized records and the minimum raw evidence required for debugging. Do not expose raw provider responses or bulk exports through Miraichi.
   - Every Miraichi surface that renders SportScore-derived data must show a visible, crawlable, dofollow link whose text includes `SportScore`. At minimum this applies to Today, Matches, and match detail.
   - Re-check the developer terms and OpenAPI checksum before staging or production promotion because the source is free and can change without an SLA.

2. **Authentication and network boundary**
   - Anonymous access must remain supported. A free `SPORTSCORE_API_KEY` is optional and server-side only.
   - When configured, the key is sent only to the exact allowlisted HTTPS host using the documented header. It must never reach browser bundles, logs, canonical records, serving payloads, or error responses.
   - Browser code calls only the Miraichi API. It never calls SportScore directly.

3. **Fifty equal competitions**
   - The existing target set of 50 competitions remains equal and competition-agnostic. Registry entries may be `club` or `national-team`; neither type receives core-code priority.
   - Each entry maps a canonical competition ID to a SportScore competition slug. Adding competition 51+ changes registry data only.
   - Registry validation must reject duplicate canonical IDs, duplicate provider slugs, missing type/season metadata, and non-HTTPS/provider-host paths.

4. **Fixture/result freshness**
   - The result objective is **best-effort within 15–30 minutes after the expected end**, not an SLA.
   - Miraichi does not persist or publish in-play snapshots. A provider response may be inspected only to decide whether a terminal recheck is needed.
   - A daily fixture sync queries each enabled competition separately. This avoids the documented 200-item day limit silently truncating a global query.
   - For competitions with matches due to finish, request terminal results at approximately expected end +15 minutes and, if still non-terminal or unavailable, once more at +30 minutes. Further retries use bounded exponential backoff and a next-run checkpoint; there is no tight live polling loop.
   - Existing scheduled and completed records are preserved when the source returns 429, 5xx, malformed data, partial coverage, or an empty response that fails completeness checks.

5. **Basic match detail**
   - Match detail is fetched lazily for a selected match and cached after the match is terminal.
   - The basic accepted projection is: teams, competition, kickoff, terminal status, full-time score, half-time/extra-time/penalty score when available, venue/round, goals with minute/scorer/assist when available, cards with minute/player/team, substitutions, and lineups/formations when available.
   - Team statistics such as corners, yellow/red cards, total shots, shots on target, possession, fouls, and offsides are optional. Missing values are rendered as unavailable, never invented or coerced to zero.
   - Predictions, picks, confidence, expected goals, player ratings, staking advice, and automated betting recommendations remain forbidden.

6. **Reliability and observability**
   - Treat 429 and 5xx as expected provider failures. Apply timeout, jittered exponential backoff, concurrency limits, request coalescing, and durable checkpoints.
   - Track request counts, status codes, cache hits, stale age, coverage gaps, last successful sync, and last terms/OpenAPI validation without recording secrets.
   - Provider identities remain in source references only. Canonical IDs and public API payloads remain provider-neutral.

7. **Provider retirement**
   - Remove all API-Football runtime code, config, scripts, tests, generated data, environment variables, and package commands now.
   - Keep ADR-0047 and its completed implementation plan as immutable decision history, but mark ADR-0047 superseded. Historical documents are not executable support.
   - Until a SportScore code slice passes integration, the worker must make no external match-provider requests.

## Consequences

### Positive

- Current fixtures and results can be validated without an immediate paid subscription.
- The expected request volume is comfortably below the published free allowance for one owner when per-competition requests are cached and result checks are bounded.
- Optional-key support allows immediate isolated smoke tests without making authentication a single point of failure.
- The provider remains removable behind canonical contracts and server-side ingestion.

### Negative and risks

- There is no SLA. A 15–30 minute result objective can be missed during outages or upstream lag.
- Coverage of detail fields varies by competition and match; corners and other team statistics cannot be promised.
- The free terms require visible attribution and may change.
- The current terms/OpenAPI scope mismatch can block staging if SportScore does not confirm that attributed free use includes `/api/v1/fixtures/`.
- A daily global fixture response can truncate at 200 items, so 50 per-competition requests are deliberately preferred over one misleading request.
- SportScore itself aggregates upstream data; Miraichi must display freshness and unavailable states and must not present the feed as authoritative betting truth.

## Verification gates

- The 50-entry registry maps all accepted competitions and passes uniqueness/type tests.
- No API-Football executable path, source token, environment variable, package script, test fixture, or generated runtime directory remains.
- Terminal-only tests prove in-play responses do not mutate warehouse, serving, or detail stores.
- Retry/503/429 and last-good preservation tests pass with zero real network calls.
- Today, Matches, and match detail render the required attribution.
- One separately approved staging smoke proves the current SportScore contract. Local mocks do not count as staging approval.
- Before that smoke, retain evidence that `/api/v1/fixtures/` is covered by the attributed free terms; otherwise stop and ask SportScore for written clarification.

## Official references reviewed on 2026-08-26

- <https://sportscore.com/developers/>
- <https://sportscore.com/developers/terms/>
- <https://sportscore.com/developers/openapi.yaml>
- <https://sportscore.com/developers/api/key/>
