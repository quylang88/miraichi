# ADR-0051: Owner-Hosted API And Visibility-Driven Live Overlay

* **Status**: Accepted
* **Date**: 2026-09-02
* **Owner approval**: Explicitly approved Koyeb Free plus Supabase Free, one-origin hosting,
  owner-only secure HTTP-only sessions, hourly background refresh, five-minute visible refresh,
  pull-down refresh without a fallback button, SportScore widget-only live data, exact attribution,
  and sequential local commits after every TDD slice.
* **Extends**: ADR-0048 only for the explicitly documented `/api/widget/*` free API boundary.
* **Preserves**: ADR-0049 current-season and terminal-result work. Historical hydration and lazy
  full match detail remain pending.

## Context

The current API is a local Node HTTP process. It has no owner authentication, emits wildcard CORS,
uses a generated serving snapshot that is intentionally gitignored, and exposes only a development
watch command. Publishing that process unchanged would expose owner bankroll, bets, settlements,
and backup mutation routes to the internet while losing local match data on an ephemeral free host.

SportScore now documents `/api/widget/*` as its free public API. A bounded probe on 2026-09-02
confirmed that `/api/widget/matches/` can return live score/status records and
`/api/widget/match/` can return the current minute and terminal status. The global list remains
capped at 50 and cannot guarantee coverage of Miraichi's registry, so it is only a best-effort live
overlay over already-known canonical current-season matches.

Koyeb Free supplies a public HTTPS URL but scales to zero after inactivity. An in-process hourly
timer therefore cannot guarantee refresh while the app is closed. A scheduled GitHub Actions HTTP
request is the background wake-up mechanism; the API applies one shared durable lease and freshness
window to background, visible, and pull-down requests.

## Decision

1. Package the static PWA and the API into one Koyeb Web Service and one origin. Koyeb's generated
   `*.koyeb.app` HTTPS URL is sufficient; Cloudflare is not required for the MVP.
2. Add a production start path. The hosted process serves `/api/v1/*`, the built PWA, and SPA
   fallback from the same port. Generated serving data is never committed into the deploy artifact.
3. Supabase Postgres remains the durable store. A hosted process starts only with Supabase mode,
   all required secrets, and applied migrations.
4. Add password-based owner login with no registration, a signed Secure/HttpOnly/SameSite=Strict
   session cookie, logout, constant-time credential checks, and fail-closed production config.
5. Remove wildcard CORS. Local split-origin development may allow one exact configured origin;
   hosted same-origin traffic needs no cross-origin permission.
6. The browser never calls SportScore. The API may call only the documented HTTPS origin and paths
   under `/api/widget/`; SportScore `/api/v1` remains forbidden.
7. Live records must resolve uniquely to an existing canonical current-season match. Unmapped or
   ambiguous widget records are counted and dropped rather than guessed. Provider identity remains
   only in private source references.
8. Persist a provider-neutral live overlay plus refresh lease/state in Supabase. Live state does not
   contaminate the terminal-only season warehouse. Confirmed terminal score/status may override the
   corresponding canonical read projection; disappearance from the global list never implies FT.
9. While the PWA is visible, refresh immediately and every five minutes. Pause on hidden/pagehide,
   resume on focus/pageshow/online, and coalesce duplicate tabs at the API lease.
10. Pull-down refresh uses the same endpoint and server cooldown. No visible fallback Refresh button
    is added.
11. A GitHub Actions schedule calls the service-token refresh endpoint once per hour. It is
    best-effort, wakes a sleeping free service, and cannot be represented as an SLA.
12. Render one static, crawler-visible `Powered by SportScore` footer with the exact required href,
    title, and `rel="dofollow"`. Remove dynamic duplicates.

## Security Boundary

- The password hash, session signing secret, refresh service token, and Supabase database URL exist
  only in Koyeb/GitHub secret stores or an untracked local `.env`.
- Health and login/session bootstrap are the only unauthenticated API reads. Every owner data route
  and live read/refresh route requires a valid owner session; hourly refresh accepts only the
  dedicated service token.
- The service token cannot access bankroll, bets, reports, backups, or general match reads.
- No public signup, multi-user identity, browser database client, or credential in built assets.

## Consequences

The first request after Koyeb sleep may be slower. Data stays stale while both the app and hourly
schedule are unavailable. SportScore live coverage is partial by contract, and free hosting has no
production SLA. These limitations must be visible rather than hidden.

## Non-Goals

- SportScore date hydration or any SportScore `/api/v1` endpoint.
- Full global live coverage, prediction, automated betting, or financial advice.
- Historical seasons, user-visible lazy full match detail, lineups, incidents, or live statistics.
- Cloudflare setup, custom domains, paid hosting, staging deployment, push, or production promotion.
