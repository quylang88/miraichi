# User-triggered hosted match detail implementation plan

Owner instruction: 2026-09-09. Boundary and researched decision: ADR-0053. Existing branch:
`feat/api-football-rapid-ingestion`, starting source `0f3de79`; Frankfurt Edge v11 and Worker
`bc4eb715-e26c-45db-833c-84785bf74443` are the rollback baseline.

Owner clarification: after every TDD slice, review requirements/code/tests, fix actionable findings,
run focused verification, then commit locally immediately before starting the next slice.

1. **Rich factual contract and provider adapter.** Files: shared `match-detail-contracts.ts`,
   `local-match-contracts.ts`, worker `sources/fotmob/fotmob-detail-adapter.ts`, colocated tests.
   RED: normalize real-shaped events, period/team/player stats, confirmed lineup, venue/attendance,
   shot coordinates and canonical team IDs; reject wrong match/league/teams/kickoff; never retain
   xG, ratings, locators or predicted lineups. GREEN: explicit typed allowlists and validation.
   Verify focused contract/adapter tests and TypeScript.
2. **Bounded provider clients and selection.** Files: worker `fotmob-detail-client.ts`, API
   `detail/match-detail-source.ts`, SportScore detail adapter, registry and tests. RED: exact path,
   timeout covers body, response cap, ETag/304, 403/429 fail closed, known current-only binding,
   observed widget slug only and at most one request. GREEN: guarded source selection/client.
3. **Durable detail cache and coordinator.** Files: API `detail/hosted-match-detail-store.ts`,
   `hosted-match-detail.ts`, tests, migration `20260909160000_hosted_match_detail.sql` and actual
   local SQL smoke. RED: concurrent click exclusion, cooldown includes failed calls, provider
   circuit/budget, expired/stale lease rejected, canonical change rejected, 304 retains data,
   failure preserves last good, rollback/cleanup. GREEN: transactional Postgres and coordinator.
4. **Owner-only explicit API.** Files: `routes/match-detail.ts`, router, runtime compositions and
   tests. RED: GET never enqueues/fetches, POST refresh only with owner/same-origin guard, exact
   one canonical ID, sanitized ready/cached/partial/stale/unavailable response. GREEN: hosted
   wiring and retire automatic queue invocation. Wire a provider request guard into detail,
   current/terminal and live clients so a persisted 403/429 circuit stops subsequent requests
   in both directions across capabilities; test the guard with actual SQL and runtime injection.
   Verify route/auth/Edge graph tests.
5. **Detail interaction and rendering.** Files: web detail service/controller/view, shell, rich
   detail renderer, EN/VI catalogs, CSS and tests. RED: open Information invokes once, no timer or
   hidden/focus refetch, cached last-good visible while pending, selection race/abort, period stats,
   expandable player details and factual shot map, empty fields/confirmed-lineup labels, safe HTML.
   GREEN: explicit user actions and accessible rich detail UI. Verify focused web/i18n tests.
6. **Committed hosted detail E2E.** Files: `tests/e2e/staging-match-detail.ts`, existing hosted
   owner suite/orchestrator. RED on old candidate, then real completed/upcoming detail; prove zero
   detail calls from list/idle/tab changes, only selected ID, cooldown cache, no automatic pending
   retry, stale/error fixture and race behavior; source/header/credential redaction and finally logout.
7. **Full local gates and deploy.** Run `verify:staging`, rich detail SQL smoke, Edge build/graph/
   runtime, static artifact and hosted TypeScript checks. Apply additive Frankfurt migration,
   deploy Edge/Worker, run committed browser E2E after each deployment and combined hosted gate.
8. **Rollback, restore and closeout.** Preserve source/bundle/Worker baseline; pause existing
   scheduler only for the bounded rollback drill, prove old runtime compatibility, restore new
   candidate and all three jobs, run combined hosted gate. Record actual versions/counts/results,
   scan secrets, scoped conventional local commits and authorized current-branch push. Stop at
   `phase:owner-feedback`; production and historical hydration remain out of scope.

## Evidence

- Research: FotMob completed and scheduled detail probes returned 200; completed body was 365,937
  UTF-8 bytes. SportScore single-match widget returned 200 with 19 incidents and two complete
  lineup lists; team statistics were absent. These samples establish observed capability, not
  guaranteed coverage across 45 competitions.
- Existing hosted detail composition has no detail store/coordinator. Existing frontend has a
  `pending` retry timer. Both are explicit targets of this phase rather than accepted behavior.
- Slice 1: missing adapter RED, then three self-review REDs (missing position became goalkeeper,
  stoppage minute parsing, invalid completed score), then independent-review REDs (missing team ID
  identity, partial lineup rejection, AET/Pen score mislabeling, missing factual metric aliases and
  permissive score/stat validation). All were fixed; 43 focused tests in two files and TypeScript,
  product-boundary and type-safety audit passed. Actual saved completed/upcoming provider payloads
  also normalized successfully: completed 21 events, 3 statistic periods, 35 team metrics,
  32 players and 43 shots; upcoming predicted/last-starting lineup was excluded.
  Independent reviewer supplied actionable findings and subsequently confirmed every fix; no
  unresolved Critical/Important finding remains in this slice. Physical-metric unit labeling
  requires separate evidence before UI display; no unit is inferred here.
- Slice 2: RED covered exact request/ETag/timeout/body bounds, single-source selection, current
  verified season, provider identity and observed widget shape. Review regression REDs caught
  streaming limits, early body cleanup, unverified legacy widget IDs and live status/minute aliases.
  All fixes passed 28 tests across five focused files (including the existing live source integration)
  and TypeScript. Independent review confirmed no unresolved findings before local commit.
- Slice 3: coordinator stub RED (six behavioral assertions), then nine focused unit tests pass.
  Actual local PostgreSQL smoke proves read creates no state, same-match/provider lease exclusion,
  60-second floor, ETag/304, last-good retention, provider circuit and 1,000-request UTC daily budget,
  expired lease and canonical identity rejection, transactional rollback and fixture cleanup.
  SQL caught a local-time conversion bug in the UTC budget-day comparison. Review REDs caught
  dropped stadium name, failure circuit lost after canonical change, and misleading provider/match
  retry delays; each was fixed. Club and national-team rows exercise the same SQL behavior.
  Provider circuits currently coordinate detail matches and read existing refresh/live circuits;
  the reverse scheduled-client guard is an explicit slice 4 runtime gate, not claimed complete here.
