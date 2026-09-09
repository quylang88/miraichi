# ADR-0053: User-triggered hosted match detail

- Status: Accepted within the owner's 2026-09-09 instruction
- Supersedes the deferred/terminal-only detail activation in ADR-0049; season hydration and
  terminal publication rules are unchanged.

The owner reopened match detail, requested the richest feasible factual data using existing or
researched providers, and required Frankfurt E2E. Refresh is limited to the single match explicitly
opened by the owner in its information view. No detail prefetch, cron, polling, automatic retry,
visibility/focus refresh or background queue is permitted.

Use FotMob's existing `/api/data/matchDetails?matchId=` capability for a known current canonical
match, including scheduled/in-progress/completed detail when provided. ADR-0049's accepted
unofficial-source risk and strict no-bypass/403/429 stop behavior remain in force. This is owner
authorization, not a claim of provider permission. Use SportScore `/api/widget/match/` only with
an already observed, unambiguous match slug; never invent slugs or fetch a date/list to discover
one during detail opening. Do not activate a new paid provider, ESPN or API-Football.

Research supports FotMob as the richest existing source. A real current EPL completed response
contained timeline, team statistics by period, lineups/coaches, player match statistics, shot
coordinates, referee, venue and attendance. A scheduled response also returned 200 with less
coverage. SportScore returned events, lineups and halftime score; its sampled stats were empty.
OpenFootball's season files provide fixture/result data, not this detail depth. Football-data.org
puts lineups/substitutions in a paid deep-data tier; TheSportsDB does not establish equivalent
free current-match detail coverage. Neither is activated.

Only allowlisted factual fields cross the adapter. Exclude xG/xA/xGOT, model ratings, fantasy
scores, momentum, betting data, automated insights, prose reviews, raw URLs/IDs and unconfirmed
predicted lineups. Historical team-form/H2H payloads are not imported in this phase. Null/missing
fields stay missing, never become invented zeros. Shot positions are displayed without xG.

Host cache, per-match lease/revision and provider cooldown/circuit in private Postgres. Explicit
POST refresh performs at most one selected-provider request; GET is a cache/canonical read only.
Use a 60-second per-match floor, bounded provider budget, timeout/body cap, ETag/304 and atomic
lease-fenced publication. Failures preserve the last good detail and report staleness. Revalidate
canonical identity at publication; detail never mutates the canonical match or bankroll state.

Stage on Frankfurt, run full local and hosted E2E, verify no request before/after the owner's
detail action, cache/cooldown, latest-selection wins, unavailable/partial/stale rendering, identity
and redaction. Exercise additive migration/runtime/Worker rollback without deleting existing data.
Commit with the project convention and stop for owner feedback. Production remains unapproved.

Sources checked 2026-09-09:
- [FotMob terms](https://www.fotmob.com/term-of-service)
- [SportScore endpoints](https://sportscore.com/developers/)
- [SportScore API terms](https://sportscore.com/developers/terms/)
- [OpenFootball JSON source](https://github.com/openfootball/football.json)
- [Football-data.org plans](https://www.football-data.org/pricing)
- [TheSportsDB API](https://www.thesportsdb.com/docs_api)

Bounded primary-payload probes used known canonical FotMob IDs and an observed SportScore widget
URL. Private raw research captures stay under gitignored `.secrets/detail-research`; committed
tests use minimal representative fixtures and identify them as fixtures.
