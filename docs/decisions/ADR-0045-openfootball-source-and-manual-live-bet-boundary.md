# ADR-0045: OpenFootball Source And Manual Live Bet Boundary

- **Status**: Accepted
- **Date**: 2026-08-01
- **Owner approval**: The owner explicitly approved option A+ on 2026-08-01.

## Context

ADR-0044 removed the former provider and required a separate owner-approved source decision. Miraichi needs broad club and national-team fixture/result coverage, but it does not need automated live-score or odds ingestion. The owner also needs to record live bets with the score, match period, minute, running line, odds, and corner state observed at placement.

GitHub community research found popular multi-site scraper libraries, but popularity does not grant access rights or make upstream HTML stable. `soccerdata` and `ScraperFC` rely on websites that can change or restrict scraping. StatsBomb Open Data is strong research data but not a broad current fixture feed. OpenFootball publishes public-domain football datasets with a documented structured-text format, active club and national-team repositories, public raw access, and no API key.

## Options

1. Use a broad HTML/multi-site scraper as the source.
2. Use a narrow documented football API and accept its free-tier coverage.
3. Use OpenFootball as the non-live match source and record live-bet context manually.

## Decision

Accept option 3, named A+.

- OpenFootball is the first authorized external match source family.
- The backend worker fetches only tracked allowlisted raw files from approved OpenFootball repositories.
- Miraichi parses a focused Football.TXT subset in TypeScript and preserves raw evidence, provenance, validation, and atomic serving publication.
- Source coverage includes configured club and national-team competitions.
- Capture defaults to every six hours and never claims live status.
- Odds, live score, match clock, period-specific state, and corner counts at bet placement are entered by the owner.
- The placement snapshot is immutable and independent from later fixture/result updates.
- HTML scraping, hidden endpoints, bookmaker crawling, automated settlement, and live-data polling are outside this decision.

## Consequences

- Miraichi gains broad, credential-free fixture/result coverage with a clear CC0 boundary.
- Data may be delayed because OpenFootball is community maintained; the UI must show snapshot freshness honestly.
- Initial implementation proves one club and one national-team competition before expanding the allowlist.
- A focused TypeScript Football.TXT parser and team alias registry are required.
- OpenFootball failures retain the last valid serving snapshot instead of blanking the app.
- Manual live-bet context requires a separate implementation plan and an additive persistence migration.
- Any additional source organization, mirror, website, odds feed, or live provider requires a new owner-approved source decision.

## Related Specifications

- `docs/superpowers/specs/2026-08-01-openfootball-match-source-design.md`
- `docs/superpowers/specs/2026-08-01-manual-live-bet-context-snapshot-design.md`
