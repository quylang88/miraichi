# Owner-Hosted API And Live Overlay Design

> **Hosting update (2026-09-03):** ADR-0052 supersedes the Koyeb and GitHub Actions deployment
> topology. The owner auth, session, live overlay, cooldown, and attribution contracts in this
> document remain current.

- **Date**: 2026-09-02
- **Decision**: ADR-0051
- **Target**: owner-only Koyeb Free Web Service backed by Supabase Free

## Runtime Topology

```text
Browser/PWA (same origin)
  -> owner session
  -> Miraichi Node API + static PWA on Koyeb
       -> Supabase Postgres: owner data, canonical snapshot, live overlay, refresh lease
       -> SportScore /api/widget/matches/ and bounded tracked /api/widget/match/

GitHub Actions hourly
  -> service-token live refresh only
  -> same refresh coordinator and durable lease
```

Koyeb supplies TLS and a generated public domain. Cloudflare is not part of the required topology.

## Authentication

Production requires password mode. The server validates an offline-generated scrypt password hash,
then signs a versioned session token with HMAC-SHA256. The cookie is Secure, HttpOnly,
SameSite=Strict, Path=/, and time-limited. There is no registration or password recovery flow.

The static authentication bootstrap calls the session endpoint before loading the application
shell. Logout clears the cookie. Local/test may explicitly use disabled auth; non-local Supabase
hosting fails closed if password mode or secrets are missing.

## Hosted Serving

The API process serves built files from `apps/web/dist`, rejects traversal, supplies correct content
types, and returns `index.html` for non-API SPA navigation. API routes take precedence. Missing web
artifacts fail startup in hosted mode. The build embeds no API URL so browser calls remain
same-origin.

The cloud snapshot must be synced to Supabase before deployment because local serving manifests and
versions remain gitignored and free-host filesystems are not durable.

## Live Contract And Mapping

The public live response is separate from `LocalMatch`, whose current contract is terminal-only.
Each live record uses the existing canonical match ID and canonical competition/team identities,
with only score, live status, elapsed minute, timestamps, and sanitized source evidence.

Widget records resolve against known current matches by normalized exact competition/team identity
and bounded kickoff equality. Exactly one candidate is required. Zero or multiple candidates are
reported as unmapped/ambiguous and never published.

The global widget list is capped at 50. A previously tracked live slug missing from the list may be
checked through `/api/widget/match/` only to determine live versus terminal score/status. Incidents,
statistics, and lineups are discarded because lazy full detail remains pending.

## Refresh Coordination

- Visible reason: five-minute freshness window.
- Pull-down manual reason: 60-second hard minimum matching upstream edge caching.
- Hourly reason: invoked once per hour, but skips when a newer successful refresh exists.
- One durable per-owner lease prevents concurrent provider calls across tabs/process restarts.
- Failure preserves the last-good live snapshot and records a sanitized error state.
- Provider requests use timeout, exact-origin containment, bounded detail follow-up, and no retry
  storm.

## Browser Lifecycle

An isolated controller owns timers and page events. It refreshes immediately on authenticated boot,
then every five minutes only while visible. Hidden/pagehide clears the timer; visible/focus/pageshow
or online performs an immediate coalesced refresh.

Pull-down starts only at scroll position zero, requires a vertical threshold, and invokes the same
controller. No fallback button is rendered. The UI exposes last updated, stale, unavailable, and
partial-coverage states.

## Attribution

The server-rendered HTML includes exactly one crawlable footer:

```html
<a href="https://sportscore.com/" rel="dofollow" title="Sports data by SportScore">
  Powered by SportScore
</a>
```

Dynamic Matches/detail attribution is removed to avoid duplicates. The footer remains because the
active snapshot already contains SportScore provenance and the live feature uses the widget API.

## Deployment And Operations

Koyeb build: install dependencies and build the static PWA. Koyeb start: run the API production
entrypoint. The health path remains `/api/v1/health`.

GitHub Actions stores only `MIRAICHI_API_URL` and `MIRAICHI_REFRESH_TOKEN` secrets. Koyeb stores the
matching refresh token plus auth/database secrets. No deploy or external secret mutation is part of
local implementation.
