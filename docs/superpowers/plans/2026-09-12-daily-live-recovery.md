# Restore actual live coverage on staging

Owner reopened LIVE on 2026-09-12: it is empty while selected match detail has live scores,
and requested a fix plus direct staging verification. Existing UI edits stay in the diff.
During verification the owner explicitly authorized committing all current changes locally
after the staging gates pass. Push remains unapproved. Use existing FotMob clients and shared circuits.

At 14:18 UTC the widget's 50 rows span 00:00–05:00 UTC and contain no live match. The hosted
snapshot maps one completed match. The daily FotMob payload contains active known EPL and
Bundesliga matches. Yesterday's successful single Liga MX observation did not prove discovery
throughout the day. More widget aliases cannot recover matches absent from its response.

Implementation interpretation of the owner's reopened LIVE requirement: extend the existing
FotMob daily capability to the separate factual LIVE overlay. This supersedes the widget-only
LIVE choice in ADR-0051 for this correction; it does not change terminal-only warehouse
publication, permit detail polling, introduce a provider, or approve historical/production work.
ADR-0049 source risk, no-bypass rule and six-hour access-block circuit remain in force.

1. RED: provider-neutral daily coverage contract and pure adapter regressions from retained
   EPL/Bundesliga raw shapes. Verify exact source match + league root + kickoff + team direction,
   malformed/ambiguous rejection, Unicode minutes, halftime and confirmed final state.
2. RED: daily source publishes more than 50 known observations, fetches at most two UTC dates
   around midnight, retains briefly missing observations without inventing FT, preserves last
   good data on errors and respects the coordinator's shared lease/cooldown. No detail request.
3. RED: explicit `LIVE_DATA_MODE=fotmob-daily` runtime selection with legacy widget/disabled
   compatibility and mandatory hosted service auth. Preserve the user's current frontend diff.
   Extend browser validation for honest daily coverage; advance the installed PWA cache.
4. Full staging gate, actual Edge runtime/build, deploy Edge + Worker to Frankfurt, select the
   daily mode, then verify nonempty real LIVE before opening any detail. Compare hosted scores
   with a fresh source observation, confirm a later real refresh and run normal hosted gates.
   Record exact times, active leagues and any limitations rather than using fixtures as proof.

## Delivered staging evidence

- Edge 19 is ACTIVE in Frankfurt (`qpexxwmrnreooxftfucv`), with `LIVE_DATA_MODE=fotmob-daily`.
  Worker `1bacf8ed-fbca-45fc-93de-ddfff0386b6e` serves the current diff at
  `https://miraichi-owner-gateway-staging.quylang88.workers.dev`.
- The real browser gate first failed because LIVE was empty. An initial daily deployment also
  failed this gate: the Deno entry omitted the new environment variable. An executable entry
  test then failed on the missing forwarded value, passed after adding the allowlist entry,
  and the corrected Edge deployment passed the unmocked browser gate.
- At `2026-09-12T14:46:34.543Z`, 30 active matches across 13 leagues rendered before any detail
  request; all 30 matched a fresh independent daily source observation. The second run at
  `2026-09-12T14:50:37.507Z` again confirmed all 30 rows. Snapshot timestamps advanced from
  `14:46:31.416Z` to `14:50:35.193Z`. Actual changes included Augsburg/Leverkusen 2–1 to 2–2,
  Mainz/Frankfurt 0–2 to 0–3, and Chelsea/Hull moving to halftime. Both runs made zero detail
  requests and used no response interception or fixtures.
- Source-confirmed leagues: Premier League, Bundesliga, La Liga, Serie A, Allsvenskan,
  Belgian Pro League, Championship, Eliteserien, Eredivisie, La Liga 2, Primeira Liga,
  Serie B and Süper Lig. This does not certify all leagues at all hours. The two rejected
  identities remain visible as `identity_mismatch:1` and `ambiguous_matches:1` warnings.
- `verify:staging`: 161 unit files / 985 tests, integration, endpoint, PWA and build all pass.
  Actual Edge auth/Postgres smoke, module graph, provider SQL concurrency/rollback smoke,
  and Cloudflare artifact verification (67 files / 416,739 bytes) pass.
- `verify:staging:hosted` passes at `2026-09-12T14:49:55.752Z`: real owner/browser/detail flows,
  three scheduler jobs, four Vault names, and valid current/terminal/live `fresh` results.
  The expired upcoming detail fixture was replaced with independently verified Sunderland/
  Arsenal, `2026-09-12T19:00:00Z`; matching requirements were preserved.
- Hosted PWA layout passes all ten Chromium/WebKit cases and real cache activation/reload in
  both engines for `miraichi-shell-v13-daily-live`. Existing user navigation edits are included.
- Independent database read at `2026-09-12T14:51:59.245601Z` retains 11,163 matches across 45
  competitions and zero drafts, bets, bankroll accounts or ledger entries.
- Ignored evidence: `output/playwright/live-empty/real-live-first.json`, `real-live-second.json`,
  `actual-live-first.png`, `actual-live.png`, `verify-staging-complete.log`, `hosted-final.log`,
  `pwa-hosted.log`, and `edge-runtime-final.log`. Credentials and raw operational captures are
  excluded from Git.

## Rollback and phase closeout

The pre-task rollback points are Edge 16 and independently inspected Worker
`52ddd314-1536-40bf-b8c9-075dd7cce532`. The preserved Edge bundle is
`output/playwright/live-empty/edge-v16-rollback.js`, SHA-256
`d42cb85d71485bda4702456320257867781f67935699364913e4da65eb545ef3`.
Restoring it also requires setting `LIVE_DATA_MODE=sportscore-widget` (or removing that variable
to use the retained legacy widget setting) and redeploying the baseline Worker. No schema
migration is introduced by this correction.

Staging exit gates are satisfied. The next phase is the final `phase:owner-feedback` checkpoint.
The owner's explicit instruction already authorizes the local commit of the complete diff;
there is no outstanding question for that action. Push and production remain unapproved.
