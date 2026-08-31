# FotMob Daily Terminal Results And Current Revalidation Design

## Goal

Update factual final scores as soon as practical after FotMob marks a known match terminal, while
keeping season hydration current-only, provider-neutral, restart-safe, and request-efficient.

Historical-season hydration remains pending. Match detail remains a later lazy-after-FT slice.

## Verified source contract

Verified on 2026-08-31 with two bounded anonymous requests and no retry, proxy, browser simulation,
or identity workaround:

- Endpoint: `GET https://www.fotmob.com/api/data/matches?date={YYYYMMDD}&timezone={iana}&ccode3={ownerCountryCode}`.
- HTTP 200, JSON, weak ETag, `Cache-Control: public, max-age=10`, response size 242,249 bytes.
- Response keys: `leagues` and `date`; 123 leagues and 379 matches on the verified date.
- Registry filtering by pinned external league ID selected 35 matches across 12 target leagues.
- Terminal rows expose stable match ID, exact UTC kickoff, `finished`, non-negative home/away score,
  and structured FT reason.
- In-play rows expose live score/time, but these fields are not persistence inputs.

FotMob terms still prohibit automatic/systematic use and robots still disallow `/api/*`. ADR-0049
is the controlling owner-risk acceptance. A 403/429 stops the run; nothing in this design bypasses
provider controls.

## Architecture

### Daily client

The provider client owns exact-origin/path containment, safe date/timezone/country-code query
construction, ETag/304, a 20-second full-response timeout, a 3 MB response bound, envelope
validation, and explicit 403/429 block errors. It performs no retry and sends no fabricated browser
headers.

### Terminal planner and ledger

The planner reads the last-good canonical snapshot and private FotMob match links. A scheduled known
match first becomes due at kickoff +105 minutes. Due matches are grouped by provider query date;
every match on that date shares one global request.

When a due match remains non-terminal, its next check is two minutes later. Missing rows use a
five-minute delay. A match stops after 45 checks or kickoff +240 minutes and is marked exhausted for
honest operator visibility. Restart state is keyed by provider + canonical match ID. Date state
stores ETag, last checked time, failure count, and next eligible attempt.

The watch loop may wake every 30 seconds, but the durable planner prevents network access before a
date or match is due. It never creates overlapping runs.

### Terminal adapter

The adapter filters leagues by exact registry external ID, then resolves matches only through an
existing private `fotmob-unofficial` provider link. Unknown terminal rows are reported and ignored;
they are not assigned a guessed season. Finished rows require valid final scores. Postponed and
cancelled rows carry no score. Scheduled and in-play rows produce no canonical delta, source link,
provenance, raw evidence, or public output.

### Publication

One job run writes at most one merged canonical warehouse/serving publication. Completed matches
cannot regress. An empty, malformed, blocked, all-live, or no-change response preserves last-good
data. Persisted request evidence contains only metadata and registry-bound terminal rows.

### Current-edition revalidation

The existing season planner gains an explicit current revalidation mode. A completed current target
becomes due only after 24 hours. Its stored ETag is sent to the season endpoint; 304 advances the
validation timestamp without publication, while a modified response uses the existing terminal-only
season adapter and atomic merge. Past seasons remain rejected by the owner-local CLI.

This daily 45-target revalidation discovers new rounds, reschedules, and newly published fixtures.
It is separate from the fast terminal-result loop because final-score latency must not require 45
season requests.

## Freshness and request budget

- First check: scheduled kickoff +105 minutes.
- Retry while known match is non-terminal: two minutes.
- Missing-row retry: five minutes.
- Terminal check limit: 45 attempts and hard cutoff at kickoff +240 minutes.
- Maximum global-date requests per one-shot run: two.
- Watch wake interval: 30 seconds; zero network requests when nothing is due.
- Current season revalidation TTL: 24 hours; at most nine season requests per batch.

The practical target is 0–2 minutes after provider FT once the first terminal window has opened.
Provider delay, incorrect kickoff, abandonment, runtime downtime, 403/429, and network failure can
make it slower. The API must report stale/exhausted states honestly; this is not an SLA.

## Stop conditions

- No current serving snapshot or missing warehouse run.
- Invalid registry or unknown competition mapping.
- Response above 3 MB, timeout, invalid JSON/envelope, or unsafe URL input.
- HTTP 403/429 circuit break.
- Candidate publication would empty or regress last-good data.
- Historical season requested.
