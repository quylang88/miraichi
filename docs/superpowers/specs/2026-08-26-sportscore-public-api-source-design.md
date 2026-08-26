# SportScore Public API Source Design

- **Date**: 2026-08-26
- **Status**: Owner-approved source boundary; Slices 0–2 complete locally, worker integration not started
- **Decision**: ADR-0048

## Goal

Enrich Miraichi's owner-only factual match API with fixtures, terminal results, and basic match detail for 50 equal competitions without paying for a provider initially. Result freshness is best-effort within 15–30 minutes after expected full time. Live data is not stored or published.

## Non-goals

- No live score screen, live event timeline, or sub-five-minute result promise.
- No web scraping, headless browser capture, private endpoints, or rate-limit evasion.
- No raw SportScore mirror, public bulk export, or browser-to-provider calls.
- No automatic picks, betting advice, odds recommendation, xG, confidence, or stake sizing.
- No guaranteed corner/card/shot/possession coverage.

## Provider contract

Use `https://sportscore.com` only. The worker uses the documented JSON endpoints and attaches an optional server-side `X-Api-Key` when `SPORTSCORE_API_KEY` exists. Anonymous access remains a tested mode.

The official documents currently disagree on scope: the terms name `/api/widget/`, while the OpenAPI describes anonymous `/api/v1/fixtures/`. Implementation may proceed against fixtures, but real staging/production remains gated on unambiguous terms coverage or written SportScore confirmation for attributed `/api/v1` use.

Primary reads:

- `GET /api/v1/fixtures/?sport=football&date=YYYY-MM-DD&competition=<slug>&limit=200`
- `GET /api/v1/match/?sport=football&slug=<match-slug>` or the documented equivalent in the current OpenAPI contract
- `GET /api/v1/search/?sport=football&q=<query>` only for controlled registry validation, never on every runtime sync

The client applies a finite timeout, identifies Miraichi through documented means, limits concurrency, coalesces identical requests, and handles 429/5xx with bounded jittered backoff. Redirects to a different host are rejected before any key is forwarded.

## Registry

The source registry contains exactly the owner-approved target set: 12 top/continental competitions, 17 second-tier/European leagues, 13 Americas/Middle East/Asia competitions, and 8 major domestic cups. Every entry contains:

- canonical competition ID and display name;
- `club | national-team` type;
- SportScore competition slug;
- enabled flag;
- season policy and optional country metadata;
- last manually validated date for the mapping.

There is no rank, priority, or national-team special case. Work is ordered deterministically and rotated between runs so failures cannot starve the same competitions.

## Daily flow

1. For each enabled competition, fetch the owner-local calendar day separately. At 50 competitions this is approximately 50 fixture requests/day.
2. Validate response identity, date bounds, team identity, and completeness signals. Normalize only scheduled/postponed/cancelled/terminal records.
3. Do not persist in-play scores/events. Use observed provider status only to schedule the next terminal check.
4. Estimate expected end from kickoff plus a conservative match duration. At +15 minutes fetch the competition/day again if at least one match is due.
5. If a due match is still non-terminal or the request fails, schedule one +30-minute check. Later retries use a durable bounded backoff and may miss the SLO honestly.
6. Merge into the last-good canonical warehouse snapshot, validate monotonic terminal status, publish the serving snapshot atomically, then advance the checkpoint.

The request count is driven by active competitions, not match count. Several matches in one competition/day share one request.

## Match detail flow

- Scheduled match: return the provider-neutral summary and an explicit message that terminal detail is unavailable; do not fetch live detail.
- Completed match with cached detail: return 200 immediately.
- Completed match without detail: enqueue one canonical match ID, return 202, resolve the provider slug server-side, fetch once, normalize, validate, and atomically cache.
- Missing provider coverage: cache a bounded `unavailable` result with reason and retry-after time so repeated page opens do not create a request loop.

Basic detail projection:

- score breakdown;
- goal/card/substitution timeline with minute and named participant when supplied;
- lineups and formations when supplied;
- per-team corners, cards, shots, possession, fouls, and offsides when supplied;
- warnings listing unavailable groups.

Numeric absence remains `null`; it never becomes `0` unless the provider explicitly reports zero.

## Attribution

Today, Matches, and match detail show a visible link such as `Powered by SportScore` pointing to `https://sportscore.com/`. The link is crawlable and dofollow. Attribution is rendered only when the displayed snapshot includes SportScore-derived source evidence, but every mixed surface that displays such records must include it.

## Storage and identity

- Raw evidence: private, bounded retention, provider path, never served.
- Canonical warehouse: provider-neutral IDs, complete snapshots, immutable runs.
- Serving store: sanitized provider-neutral match data.
- Source links: private mapping between canonical ID and SportScore slug/ID.
- Match detail: terminal factual projection only.
- Ledger: request observations, retries, checkpoints, cache outcome, and terms/OpenAPI validation timestamp; no secret value.

## One-owner capacity estimate

Baseline is approximately 50 daily fixture requests. Two terminal rechecks on a busy day add at most two requests per active competition, not per match. Lazy detail normally adds one request per opened completed match. This is far below the published approximate free allowance, but the design still caps requests because availability—not headline quota—is the real risk.

## Failure behavior

- 429/5xx/timeout: preserve last good, record retry, expose stale age.
- Malformed/partial response: quarantine evidence, no publication.
- Missing statistics: publish factual core with warnings and null fields.
- Competition mapping mismatch: disable only that registry entry and report it; do not remap by fuzzy name automatically.
- Terms/OpenAPI drift: fail staging/release validation until reviewed.
- Terms/OpenAPI path-scope mismatch: local mocks may pass, but real staging remains blocked pending written or published clarification.
