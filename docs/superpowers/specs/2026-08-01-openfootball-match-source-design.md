# OpenFootball Match Source Design

## Status

- **Status**: Owner approved; written-spec review complete
- **Date**: 2026-08-01
- **Lifecycle command**: `phase:plan Website Source Selection And Crawler Boundary`
- **Owner decision**: A+ — use OpenFootball for non-live match data and keep live-bet context manual.

## Straight Conclusion

Miraichi will use the OpenFootball GitHub organization as its first approved external match source. The worker will fetch allowlisted public Football.TXT files from `raw.githubusercontent.com`, archive the exact response, parse only the factual subset Miraichi needs, normalize it into provider-neutral contracts, and publish it through the existing canonical warehouse and serving-store pipeline.

This is not a live-score feed. It supplies scheduled fixtures and periodically updated results. Odds and the state observed when placing a live bet remain owner-entered data covered by the separate Manual Live Bet Context Snapshot design.

## Research Evidence

The source review was performed on 2026-08-01. Star counts are observational signals, not guarantees.

| Candidate | Observed community signal | Stability and access finding | Decision |
| --- | --- | --- | --- |
| `probberechts/soccerdata` | About 1,930 stars; active in July 2026 | Broad Python scraper, but its README explicitly warns that upstream website changes break scrapers. It includes sources whose terms restrict scraping. | Reference only; not a runtime dependency or approved source. |
| `oseymour/ScraperFC` | About 401 stars; active in 2026 | Broad Python/GPL scraper whose supported sources include Sofascore and other changeable websites. | Rejected for Miraichi runtime. |
| `hudl/open-data` | About 3,485 stars | High-quality selected StatsBomb research datasets, not a current broad fixture feed. | Rejected as the primary operational source. |
| `JaseZiv/worldfootballR` | About 602 stars | Archived by its owner in September 2025. | Rejected. |
| `openfootball/football.json` | About 985 stars; CC0 | Convenient generated JSON, but generated collections can lag the upstream country/tournament repositories. | Reference and fixture source for tests, not the primary runtime source of truth. |
| OpenFootball upstream repositories | `worldcup` about 698 stars, `england` about 476 stars and more than 1,100 commits; current 2026 activity | CC0/public-domain data, public raw files, documented Football.TXT format, club and national-team coverage, no API key. | Accepted source family. |

Evidence links:

- <https://github.com/probberechts/soccerdata>
- <https://github.com/oseymour/ScraperFC>
- <https://github.com/hudl/open-data>
- <https://github.com/openfootball/football.json>
- <https://github.com/openfootball/england>
- <https://github.com/openfootball/europe>
- <https://github.com/openfootball/champions-league>
- <https://github.com/openfootball/world>
- <https://github.com/openfootball/worldcup>
- <https://openfootball.github.io/spec/>

## Approved Product Boundary

The first source slice may ingest:

- competition and season labels;
- club and national-team names;
- fixture date and kickoff time when explicitly available;
- round, group, stage, and venue text;
- scheduled fixtures and completed scores;
- half-time scores when explicitly present.

The first source slice must not ingest or infer:

- live match clocks or live score polling;
- odds, bookmaker data, or hidden website endpoints;
- lineups, cards, substitutions, event timelines, or statistics not consistently present in the approved files;
- predictions, recommendations, stake calculations, or confidence scores;
- public GitHub search results or arbitrary owner-supplied URLs at runtime.

## Program Decomposition

The approved A+ direction contains two independent implementation tracks:

1. **OpenFootball Match Source** — external fixture/result capture, parsing, normalization, validation, and serving publication.
2. **Manual Live Bet Context Snapshot** — owner-entered match state and market state at the moment a live bet is recorded.

Each track requires its own `phase:implementation-plan`. Neither implementation may silently expand the other track.

## Source Registry

Runtime source discovery is forbidden. Every fetched file must be declared in a tracked allowlist entry equivalent to:

```ts
export interface OpenFootballCompetitionSource {
  sourceId: 'openfootball';
  competitionId: string;
  competitionType: 'club' | 'national-team';
  repository: 'england' | 'europe' | 'champions-league' | 'world' | 'worldcup';
  ref: 'master';
  filePath: string;
  season: string;
  sourceTimezone: string;
  refreshIntervalMinutes: 360;
  enabled: boolean;
}
```

`repository`, `ref`, and `filePath` are data, not executable URL fragments supplied by a browser. Validation must reject path traversal, unknown repositories, non-HTTPS origins, unknown competition types, invalid IANA timezones, and refresh intervals below 360 minutes.

Initial implementation coverage is deliberately small: one club competition and one national-team competition must prove the complete pipeline before more allowlist entries are added.

## Fetch Boundary

Only the backend worker may access OpenFootball. The browser continues to call the Miraichi API.

The worker builds exact URLs under:

```text
https://raw.githubusercontent.com/openfootball/<repository>/<ref>/<filePath>
```

Fetch behavior:

1. Set a descriptive `User-Agent` for Miraichi.
2. Use conditional GET with `If-None-Match` or `If-Modified-Since` when prior response metadata exists.
3. Use a finite request timeout and bounded retries for network failures and `5xx` responses.
4. Respect `Retry-After` for `429` responses.
5. Never retry `404`, invalid content type, oversized payload, or validation failure in a tight loop.
6. Archive every successful changed payload before parsing it.
7. Record `not_modified`, `failed`, `invalid`, and `published` outcomes in a manifest.

The worker does not scrape GitHub HTML pages, use GitHub repository search, execute downloaded code, clone repositories at runtime, or require a GitHub token for the first slice.

## Raw Evidence And Provenance

The existing provider-neutral raw cache remains the evidence boundary. The raw envelope must record:

- source ID and allowlist entry ID;
- repository, ref, and file path;
- final URL path without credentials;
- fetch time;
- response ETag and Last-Modified when present;
- SHA-256 payload hash;
- content type and byte count;
- exact UTF-8 text payload.

Canonical entities must retain provider links and field provenance. The API serving model must not expose provider-specific IDs or raw GitHub paths as match identity.

## Football.TXT Parser Boundary

Miraichi will implement a focused TypeScript parser for the accepted Football.TXT Level 1 subset. It will not add a Python, R, Ruby, or local service dependency.

The parser must support:

- competition header;
- round or matchday outline;
- date headers with an explicit year or a year inherited from the competition header/date block;
- explicit and inherited kickoff time within a date block;
- scheduled match lines using a whitespace-delimited `v` or `-` between teams;
- completed match lines using an explicit full-time score, with optional half-time score, between the home and away team names;
- full-time and half-time scores when present;
- optional venue text introduced by `@`;
- recognized indented scoring-detail continuation blocks that are deliberately ignored by the first source slice;
- blank lines and `#` comments.

The parser must fail closed on ambiguous date order, missing competition mapping, impossible scores, unsupported encoding, an unrecognized match line, or a source timezone that is absent from the registry. It must never invent noon, midnight, UTC, a match status, or a team identity to make a record pass.

## Canonical Identity And Time

Team aliases are resolved through tracked competition configuration. A source spelling is not automatically a canonical team ID.

A match identity key is derived from the provider-neutral tuple:

```text
competitionId | season | normalizedRound | homeTeamId | awayTeamId
```

The kickoff date is intentionally excluded so a rescheduled fixture retains identity. Duplicate identity keys within one competition season block publication.

Kickoff conversion uses the allowlist entry's IANA timezone. An explicit source offset takes precedence. Missing or ambiguous time causes the individual record to be skipped with a manifest error; no guessed kickoff is published.

## Status Mapping

OpenFootball is not treated as live data:

- fixture with no score: `scheduled`;
- fixture with an explicit full-time score: `completed`;
- explicit unsupported or ambiguous state: `unknown` and withheld from serving until the mapping is approved.

The adapter never emits `in_play`. A completed score is factual source data, not a settlement instruction for owner bets.

## Validation And Atomic Publication

A capture run must pass these gates before publication:

- allowlist and URL validation;
- payload size, encoding, and content validation;
- parser fixture tests for the exact source sample;
- canonical contract validation;
- no duplicate match identity;
- every team and competition resolves to a configured canonical entity;
- every published kickoff has a deterministic UTC value;
- minimum expected record count for the allowlist entry;
- no unexpected deletion beyond the configured safety threshold.

Publication is atomic. A failed run writes evidence and manifest errors but never replaces the last valid serving version. The API continues serving the last valid snapshot and reports it as stale when appropriate.

## Freshness And UI Semantics

The default capture interval is six hours. Manual owner refresh may request an immediate run but cannot bypass rate limits or validation.

The web application displays snapshot generation time and one of `ready`, `stale`, or `unavailable`. It must not display “live” for OpenFootball data. Miraichi never claims OpenFootball data is live. Source fetch freshness describes when Miraichi checked the source; it does not guarantee that a community-maintained result was updated at that instant.

## Failure Handling

- `304`: retain prior raw payload and record a no-change run.
- transient network error, `429`, or `5xx`: bounded retry, then retain the last valid serving version.
- `404` or moved path: mark the allowlist entry unavailable and require a reviewed config change.
- parse or validation regression: quarantine the new payload and retain the last valid serving version.
- partial competition failure: do not publish a partially rebuilt competition partition.
- missing last valid snapshot: API returns an honest empty or unavailable state.

## Security And Legal Boundary

- Only CC0 OpenFootball data repositories named in the registry are authorized.
- New organizations, websites, mirrors, licenses, or hidden APIs require a new source review and owner approval.
- No credentials are embedded in source code, raw envelopes, logs, or browser bundles.
- Downloaded text is data only and is never evaluated or executed.
- Payload size and path limits protect the worker and repository from accidental bulk ingestion.

## Acceptance Criteria

The later implementation is acceptable only when:

1. one club and one national-team allowlist entry complete the full raw-to-serving path;
2. the parser passes recorded Football.TXT fixtures and fails on ambiguity;
3. no browser request reaches GitHub or OpenFootball;
4. no odds or live-state behavior is introduced;
5. a failed update demonstrably preserves the last valid serving version;
6. canonical match IDs remain provider-neutral;
7. product-boundary, local, and integration verification pass.
