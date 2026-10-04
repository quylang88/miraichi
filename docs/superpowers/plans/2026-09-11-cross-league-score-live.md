# Cross-league terminal scores and LIVE corrections

Owner authorization: 2026-09-11. Fix scores on Matches and LIVE across the existing registry,
deploy Frankfurt staging and verify hosted E2E. The accepted PWA baseline is local commit
`ce5e575`. No push, new provider, historical-season hydration or production promotion.

## Observed defects

- At 03:13 UTC, scheduled Libertadores Independiente del Valle/Flamengo and Sudamericana
  Cienciano/Montevideo City Torque had final 0–2 and 2–0 daily provider records. The daily
  groups used stage IDs `1000001641`/`1000001659` and root IDs `45`/`299`; the adapter only
  looked at `id`. MLS terminal checkpoints had exhausted 45 attempts before daily season
  revalidation eventually supplied the scores. Check the whole registry, not a league switch.
- The real SportScore widget list supplies `url: /football/match/<slug>/`, not `slug`.
  Staging's 03:10 UTC snapshot had 50 upstream rows, 30 invalid rows and zero mappings.
  Known competition/team label differences also require explicit verified identity handling.
- SportScore's documented global 50-record window still limits coverage. Preserve the accepted
  widget-only live source; do not silently enable FotMob in-play publication prohibited by ADR-0049.
- Retained legacy duplicates exist (including Santos/Santos FC); audit them separately from
  fresh scheduler failures. Do not delete or reassign owner-linked canonical rows by name guesses.
- The current widget also uses `Mexico Liga MX`, `Pumas U.N.A.M.` and `Club Leon` where the
  canonical rows say Liga MX, Pumas and León. The two sources agree on home/away and kickoff;
  add exact aliases. Period text such as `1st half` must not be parsed as elapsed minute 1.

## Sequential slices

1. **Daily competition identity** — RED in
   `apps/worker/src/sources/fotmob/fotmob-daily-adapter.test.ts` using real root/group identities,
   all enabled registry bindings, missing/conflicting parents and cross-competition links.
   Extend daily payload types and resolve one consistent registered root in the adapter.
   Keep canonical provider-match identity and terminal-only publication. Focused daily/client tests.
2. **Widget identity** — RED in `apps/api/src/live/sportscore-live-adapter.test.ts` using real
   URL-only widget rows, strict URL/slug agreement, competition aliases and evidence-backed
   team labels. Preserve ambiguity rejection, exact home/away direction and kickoff bounds;
   apply the same validation to tracked terminal checks. Focused live/client/coordinator tests.
3. **Cross-module regression** — hosted-provider tests and an integration regression feed the
   retained real daily/widget shapes through refresh/store/read projection. Date-boundary cases
   cover UTC and Asia/Tokyo and explicitly simulated live/halftime/finished transitions.
4. **Staging gate** — full `verify:staging`, generated Edge graph/runtime and artifact checks,
   deploy current Edge/Worker with rollback references retained, then `verify:staging:hosted`
   plus new browser checks on actual final scores and deterministic LIVE transitions.
   Audit all current registry rows and report provider-window/identity limitations honestly.

Raw diagnostic captures are gitignored under `output/playwright/score-live/`; commit only the
minimal source-contract fixtures needed for regression. Existing owner records are not test data.

## Implementation and regression evidence

- Daily resolution uses consistent `primaryId`/`parentLeagueId` before stage/season `id`;
  rejects malformed/conflicting roots and preserves exact provider match + competition identity.
  The registry-wide RED run failed 55 cases before the fix. Real September 10 replay covered
  19 terminal rows, including MLS, Champions League and Swiss Super League groups previously ignored.
- Widget URLs accept only the documented relative match path, reject conflicting URL/slug,
  and use configured competition aliases plus exact observed team labels. Qualifiers such as
  U21 and W remain significant. Tracked terminal checks also validate competition and kickoff.
  URL/label RED failed 55 cases; Liga MX added one observed failure before correction.
- A persisted terminal contract version invalidates old ETags once and resets nonterminal
  attempts only for currently due records. The four-hour eligibility window, date request cap,
  two-minute cooldown, circuits and transactional publication fence remain in force. Its test
  failed before implementation and confirms no repeated reset after a completed result.
- Strict elapsed-minute parsing handles `45+2` as 47 and rejects `1st half`/`2nd half` as minutes;
  the generic LIVE status can take the period from its specific label. Three RED cases preceded
  this correction; focused live/coordinator/integration verification passes 76 tests.
- `pnpm run test:e2e:staging:scores` checks actual retained Libertadores 0–2, Sudamericana 2–0
  and MLS 1–2 in API + rendered cards at UTC and Asia/Tokyo without opening detail. Its separate
  synthetic LIVE/halftime/completed fixtures run through the real adapter and hosted UI.
  The predeployment gate failed on the real Libertadores score, then passed both timezones on Edge 15.
  These synthetic transitions are not evidence of observing those three leagues live in real time.
- Edge 15 scheduler wrote both CONMEBOL results at `2026-09-11T04:03:00.302Z` and persisted
  `terminalContractVersion: 2`. The real widget snapshot improved from zero mapped / 30 invalid
  to four mapped / zero invalid; remaining unmapped rows are retained as coverage warnings.
  A real widget detail read for the Libertadores match also mapped the final 0–2 successfully.

## Remaining data-quality observations

The whole-database audit found 32 older scheduled rows past four hours: Brazil 4, Sudamericana 1,
Thai League 1, Premier League 2 and Conference League 24. Six share a provider match ID and kickoff
with completed canonical rows under different team spellings. The other 26 retain the retired
SportScore hydration identity and have no exact shared-provider match in this audit. These are
retained legacy identity/reconciliation issues; the fresh terminal-parser fix does not reconcile
or delete them. Preserve IDs and owner references; this needs a separately validated reconciliation
slice rather than copying scores by guessed names. This audit is not evidence that every older
scheduled row represents an unplayed match or that all stored data is clean.

LIVE remains a global recent window of at most 50 provider records. Fifty configured identity
tests and 45 populated competitions do not prove complete real-time coverage of all competitions.

## Final staging candidate and checks

- **Deployment**: Frankfurt Supabase project `qpexxwmrnreooxftfucv`, `miraichi-api` ACTIVE version 16.
  Existing Cloudflare Worker `2b262278-b532-4b89-b3c6-25a69b99c914` remains the accepted UI.
  No schema migration, source replacement, production promotion, bug-fix commit or push.
- **Final local gate**: `pnpm run verify:staging` passed 157 unit files / 918 tests, full
  integration/endpoint/PWA verification and static build. Generated module graph and actual
  Edge auth/Postgres smoke passed; provider SQL smoke proves lease, atomic publication,
  expiry fencing and rollback. Cloudflare artifact remains 67 files / 414,263 bytes.
- **Hosted score gate**: `pnpm run test:e2e:staging:scores` passed on version 16 for UTC and
  Asia/Tokyo: three real final-score samples per timezone, zero detail requests, plus explicitly
  synthetic three-league LIVE/halftime/completed transitions, minute and score assertions.
  Screenshots of each actual target card and the synthetic LIVE rows were visually inspected.
- **Combined hosted gate**: `pnpm run verify:staging:hosted` passed on version 16 at
  `2026-09-11T04:17:29.360Z`, including the real owner/detail flow, deterministic browser
  fixtures, redaction, logout, three active cron jobs and four Vault names. Controlled
  current/terminal/live scheduler deliveries each returned a valid `fresh` outcome.
- **Real LIVE observation**: at `2026-09-11T04:16:20.375Z`, the hosted UI displayed Pumas/León
  1–0 from an unmocked refresh generated at `04:16:18.489Z`. Backend status was LIVE, period
  `second_half`, elapsed minute null because the source supplied no exact minute. Four records
  mapped, none were invalid, and 27 unmapped rows remained explicitly warned. The UI correctly
  displayed partial coverage and LIVE without inventing a numeric minute.
- **Persistence audit**: independent read at `2026-09-11T04:14:06.647361Z` retained 11,163
  matches / 45 competitions, parser contract version 2, and zero drafts, bets, bankroll
  accounts or ledger entries. E2Es created no owner data.
- **Rollback**: pre-fix Edge 14 generated bundle retained in ignored
  `output/playwright/score-live/edge-v14-rollback.js`, SHA-256
  `4bc8fdfdcbf0564582a168ce089a57b6bf7270d4cdaf3208ef7dd5f5c5a295ba`.
  Final bundle SHA-256 `d42cb85d71485bda4702456320257867781f67935699364913e4da65eb545ef3`.
  Redeploy the retained Edge 14 implementation if rollback is required; preserve the Worker
  and database. This run retains rollback artifacts but did not perform another rollback drill.
- **Evidence**: ignored `output/playwright/score-live/` retains RED/GREEN logs, source captures,
  before/after database reads, deployment responses and screenshots. The final retained tests
  and fixture file contain only the minimum factual contracts needed for regression.
