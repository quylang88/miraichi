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
5. **Detail interaction and rendering (two reviewed local commits).** Files: web detail service/controller/view, shell, rich
   detail renderer, EN/VI catalogs, CSS and tests. RED: open Information invokes once, no timer or
   hidden/focus refetch, cached last-good visible while pending, selection race/abort, period stats,
   expandable player details and factual shot map, empty fields/confirmed-lineup labels, safe HTML.
   GREEN: explicit user actions and accessible rich detail UI. Slice 5A is service/controller/shell
   interaction; slice 5B is rich rendering/i18n/CSS. Review and commit 5A before coding 5B.
   Verify focused web/i18n tests.
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
- Slice 4: route/router/Node REDs prove the old GET/queue behavior and missing explicit route;
  guard REDs prove repeated network calls despite a provider block. GET is now cache-only, POST
  requires exactly one canonical ID, owner auth and origin checks remain enforced, and Node/Edge
  compositions use the durable coordinator. A separate private common circuit catches 403/429
  before client parsing and is checked by current, terminal, detail and both widget operations.
  SQL smoke exercises the actual Edge handler: rich GET sends zero provider requests, explicit
  POST sends one, and cooldown sends none. It also proves the persisted common circuit prevents
  both a scheduled request and detail lease acquisition. TypeScript, product boundary, type audit
  and Edge build/module graph pass; owner API integration retains locator redaction.
- Slice 5A: five RED assertions across controller/service/shell prove the old automatic timer
  and GET-only behavior. The controller now starts only from explicit Information/Retry actions,
  reads cached detail before one POST refresh, bounds memory to 20 matches, aborts on leave,
  ignores late previous-match responses, and retains last-good after failure. Pending responses
  do not create a timer. Service rejects a valid payload belonging to another canonical ID.
  Seventy focused tests pass across controller, service and shell; TypeScript passes.
- Slice 5B: initial rendering REDs and independent review regressions are fixed: shot-accuracy
  fractions retain their numerator, partial observed live scores do not show a prematch separator,
  first-load failure does not claim saved detail, and known coaches remain visible without lineups.
  Rich periods, expandable player metrics, factual shot map, venue/attendance and manual refresh
  states have EN/VI parity. Unverified physical units remain hidden. Sixty-eight focused tests,
  TypeScript, product boundary, type audit and PWA verification pass. Real Chromium rendering of
  the saved completed provider sample at 390px and 1100px shows 3 periods, 32 players and 43 shots;
  a mobile score-column clipping assertion failed before the CSS fix and now passes. This is
  local visual evidence; no detail-phase staging deployment has occurred at this slice boundary.
- Slice 6: committed hosted-owner flow now includes completed/current upcoming detail, exact
  selected-ID GET/POST counts, manual cooldown and rendered rich facts. Browser fault fixtures
  separately prove last-good retention, late-A/selected-B isolation and cold HTTP 202 without a
  retry timer. The fully local static-browser harness passes with club/national-team fixtures;
  this is explicitly not provider evidence. The old Frankfurt candidate failed the new gate with
  `explicit selected POST refresh missing`, establishing hosted RED. TypeScript passes. Review
  fixed an unbounded race-test Promise and a false assertion when two matches share a home team.
  New-candidate hosted GREEN remains the required post-deployment gate in slice 7.
- Integration correction: the first full gate exposed one fixture literal violating the existing
  architecture audit (795 tests passed, one failed). Reusing the canonical fixture competition name
  fixes the test without widening an allowlist. The artifact gate also failed at 64 versus 67 files;
  its baseline now includes the reviewed shared detail contract, controller and enrichment renderer.
  Eleven focused tests and the actual 67-file artifact dry run pass. Disposable local Edge credentials
  had a password/hash mismatch; aligning only the ignored local hash restored all actual Edge runtime
  auth/Postgres smoke gates. No staging credential or runtime configuration changed.
- Hosted acceptance correction: Edge v12 and Worker `e735457e-245f-474f-8df3-965be8eb6041`
  first passed completed rich detail, but the arbitrary upcoming selection failed. Santos/Cruzeiro
  has a canonical/provider identity conflict: canonical Santos FC on September 12 versus provider
  Santos on September 13. No detail was published; neither source is declared authoritative by this
  observation. The identity fence stays intact and canonical revalidation is a separate operation.
  Upcoming acceptance is now pinned to the pre-implementation AFC Bournemouth/Brentford sample,
  canonical `match-294a35225edcdf2afb906c57`, September 12 at 14:00 UTC. The gate fails when that
  sample is missing, rescheduled or no longer upcoming; replace it with new verified evidence then,
  never skip. Actual hosted browser E2E passes completed `not_modified`, upcoming `refreshed`,
  3 periods / 32 players / 43 shots, manual fault fixtures, logout/replay and network redaction.
  These two samples prove acceptance, not uniform coverage of all 45 competitions.
- Slices 7–8: complete local staging gate passes 157 files / 796 tests plus all integration,
  endpoint, PWA and build checks; real SQL, Edge runtime, graph and artifact checks pass. Thirteen
  migrations are applied to Frankfurt. The initial Edge deployment was v12; rollback restored
  the verified v11 source as v13, then restored the detail bundle as ACTIVE v14. Worker
  `e735457e-245f-474f-8df3-965be8eb6041` serves 100%. E2E ran after every deployment, exposing
  expected missing-POST behavior while old UI was active and passing after combined restoration.
  The baseline owner/LIVE suite also passed against the additive schema. At `02:11:21.805Z`,
  restoration retained 11,163 matches, 35 snapshots, two detail caches, four Vault names, three
  jobs and zero bets/ledger entries. Final combined `verify:staging:hosted` passed at
  `2026-09-10T06:11:26.413Z`, with browser and all three scheduler operations green. The next
  phase is the requested owner feedback; no production action follows automatically.
