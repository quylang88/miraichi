# Add Bet simplification and evidence-gated automatic settlement

Owner continuation: 2026-09-15. Keep the existing Frankfurt Structured Add Bet candidate and its
uncommitted Slice 11 acceptance evidence intact. Follow RED -> minimal GREEN -> focused tests ->
requirement/diff/i18n/regression review -> fix findings -> rerun tests and `git diff --check` ->
one local commit per clean slice. No push, production promotion, new provider, or automatic detail
request is authorized. Existing ADR-0053 limits hosted detail refresh to an explicit owner action.

## Decisions and factual limits

- New Add Bet binds an exact canonical `matchId`, locks Home/Away as read-only values, and rejects
  client-supplied team names that differ from the canonical match. The unscoped Manual Add and
  Today Quick Add paths cannot coexist with locked teams and are removed. Existing unlinked drafts
  and bets remain readable and manually settleable; their data is not deleted.
- Remove Motivation and Plan Adherence from new-entry UX and accept them as absent for new bets.
  Never manufacture `planned_analysis` or `yes`. Legacy psychology and discipline history remain
  readable; other discipline rules still operate. Emotion remains three-state, default calm.
- First-half corner presets are `2.5, 3.5, 4.5, 5.5, 6.5`; `5.6` is not a valid quarter-step line.
  Full-time presets remain unchanged. Manual quarter-step entry remains available.
- Running selection is always Over. The owner chooses a goal threshold `0.5` or `0.75` for HT/FT;
  fixed 15 minutes forces `0.5`. The UI does not ask for a selection or free-form line. The server
  derives the canonical line from the placement score plus threshold for HT/FT; fixed 15 uses
  Over 0.5 goals scored in that interval. Placement score is required. Minute is optional for
  HT/FT. Without a reliable placement minute, fixed-15 is manual-settlement-only; with one, it
  may auto-settle only when the bet precedes/equals the selected window's start and complete
  non-partial goal evidence exists. The interface explains this limit before recording.
- Running HT/FT outcomes are calculated on goals after placement: 0.5 wins after one goal;
  0.75 half-wins after one goal and full-wins after two. The existing Hong Kong odds calculator
  applies full/half win/loss/push. Quarter Asian lines split stake over the neighboring lines;
  no payout estimate or recommendation is added.
- Auto-settlement only evaluates pending bets linked to the exact completed canonical match.
  FT 1X2, goals and handicap use a validated final score. HT requires a trustworthy halftime
  breakdown; corners require the matching period's corner totals; fixed-15 requires complete
  minute-stamped goals. Cached detail may be used only if its canonical identity and terminal
  score agree, it is complete for the needed field and it is not marked partial/stale.
  Missing/contradictory/unlinked evidence never changes bankroll or ledger; the bet is visibly
  marked `manual_required` with a reason and retains the existing manual settlement path.
  A later score/detail correction requires explicit owner review/correction, not silent ledger
  rewriting. Postponed/cancelled/extra-time ambiguity is also manual review, not guessed void.

The rule boundary for quarter totals and in-play remainder is documented by
[Pinnacle](https://www.pinnacle.com/en/future/betting-rules) and
[bet365](https://help.bet365.com/s/en/sportsrules/soccer/asian-handicap). An interval needs its
own time boundary; see [William Hill](https://help.williamhill.com/hc/en-gb/articles/28860648769565--Other-Football-Rules).
Provider fixtures in tests are deterministic, not live-source evidence.

## Sequential TDD slices

### 0. Scope and plan

- Files: this plan and `PROJECT_PLAN.md` active phase note.
- Review: no picks, stake advice, ROI, provider activation, automatic match-detail fetch,
  destructive migration, production action, or leaked owner data.
- Commit: `docs: plan evidence-gated bet settlement quality-up`.

### 1. Locked canonical match entry; remove unscoped/Quick Add

- RED: `apps/web/src/features/add-bet/add-bet-session.test.ts`,
  `apps/web/src/production-shell.test.ts` and `tests/e2e/structured-add-bet.ts` prove team
  fields are editable and unscoped actions still open the sheet.
- GREEN: `apps/web/src/features/add-bet/add-bet-session.ts`, `apps/web/src/components/app-shell.ts`,
  Today/Matches/Bets/Bankroll screens and `apps/web/src/shell-entry.ts` lock scoped teams and
  remove all unscoped entry actions. Existing draft edit remains readable; an unlinked draft
  cannot create a new bet without selecting a canonical match. No HTML `disabled` attribute
  that would discard the team names from FormData.
- Verify: focused Vitest and deterministic 320px/390px browser flow.
- Commit: `fix(web): bind add bet to a locked match`.

### 2. Canonical team identity at API

- RED: `apps/api/src/routes/bets.test.ts` and `bet-drafts.test.ts` accept a mismatched/unknown
  client team despite `matchId`.
- GREEN: require exact canonical match ID for new bet/draft POST and server-normalize team names;
  preserve legacy PUT/read/backup compatibility. No fuzzy matching or team reversal.
- Verify: focused routes, endpoint integration, backup regression.
- Commit: `fix(api): verify add bet match identity`.

### 3. Remove new-entry Motivation and Plan honestly

- RED: `packages/shared/src/contracts/core-betting-contracts.test.ts`, bet/draft/settlement
  routes and production shell tests require/select those values.
- GREEN: optional values for new bets; omit UI fields; keep legacy reporting and discipline
  histories. Make settlement-event plan adherence nullable/absent with additive PostgreSQL
  migration and SQL mirror, adapters and backup round-trip. Existing legacy values never change.
- Verify: contracts, bet/discipline/settlement/report tests, SQL and rollback-only PG smoke.
- Commit: `fix(bets): omit unnecessary pre-bet psychology`.

### 4. First-half corners catalog

- RED: `packages/shared/src/config/betting-market-catalog.test.ts` and
  `apps/web/src/features/add-bet/bet-entry-model.test.ts` show FT presets in HT.
- GREEN: period-specific catalog presets and UI reset. `5.6` is rejected by quarter-step
  validation; `5.5` is offered.
- Verify: focused catalog/model/shell/i18n tests.
- Commit: `fix(web): correct first-half corner presets`.

### 5. Running derived contract and persistence

- RED: `structured-bet-selection.test.ts`, bet/draft routes, SQL/adapter tests demonstrate
  mandatory minute, arbitrary Under/line and missing threshold.
- GREEN: `runningGoalThreshold` for `0.5 | 0.75`, forced Over and canonical derived line;
  fixed-15 forced 0.5, score required, minute optional. Add nullable threshold column and
  constraints/mirrors; maintain read-only legacy Running compatibility without creating more
  unnormalized records. Server ignores/fails client-supplied contradictory line/selection.
- Verify: focused shared/API/SQL/memory/Supabase/backup tests and rollback PG smoke.
- Commit: `feat(bets): derive running over threshold`.

### 6. Running entry UX

- RED: bet-entry model/shell/E2E still expose Under/free line, require minute, and allow stale
  fixed intervals without warning.
- GREEN: score pair, optional minute, HT/FT 0.5/0.75 chips, fixed-15 0.5-only; show manual
  review fallback for missing minute/events and retain exact fresh snapshot provenance.
- Verify: focused model/shell/i18n and deterministic browser 320px/390px/landscape.
- Commit: `feat(web): streamline running bet entry`.

### 7. Pure settlement evaluator

- RED: `packages/shared/src/calculator/structured-bet-outcome.test.ts` covers all quarter
  split full/half win/loss/push, 1X2, signed handicap, goals/corners FT/HT, running 0.5/0.75,
  fixed-15 boundary and missing/contradictory detail.
- GREEN: a pure provider-neutral evaluator returning either exact settlement type + evidence
  or `manual_required` reason; no ledger mutation or odds recommendation.
- Verify: focused calculator and contracts tests.
- Commit: `feat(shared): evaluate evidence-backed bet outcomes`.

### 8. Durable review status and idempotent auto settlement

- RED: API/persistence tests show pending records cannot retain a manual-review reason and
  duplicate terminal callbacks can double-write ledger.
- GREEN: nullable review status/reason/evidence timestamp with additive migration, API read
  mapping, backup round-trip and deterministic settlement event ID; reuse transactional
  `applyBetSettlement` and prohibit auto correction. A single pending bet's ledger update is
  atomic/idempotent. Separate attempts do not erase reasons or overwrite owner settlements.
- Verify: memory/Supabase/SQL/settlement tests and rollback PG smoke.
- Commit: `feat(persistence): track safe auto settlement review`.

### 9. Terminal reconciliation without new detail requests

- RED: hosted refresh/coordinator tests prove terminal matches do not evaluate linked pending
  bets, cached partial/identity-mismatched detail is trusted, or a failed bet blocks match
  publication.
- GREEN: after canonical terminal publication, reconcile exact linked pending bets against
  canonical score and existing validated cache only; never call provider detail automatically.
  Failed/unavailable detail sets manual-review status, and a retry may use owner-refreshed detail.
  Keep lease fences, bounded batch and owner boundary.
- Verify: focused coordinator/Postgres runtime/Edge graph tests.
- Commit: `feat(api): reconcile terminal bets from trusted evidence`.

### 10. Manual review UI and E2E

- RED: shell/browser tests show insufficient detail as an ordinary pending bet with no reason
  or action; malformed payload/half settlement is unprotected.
- GREEN: distinguish pending, auto settled and manual-required with localized reason/action;
  manual settle remains available. Commit deterministic end-to-end fixtures with `finally`
  cleanup; no bet/ledger records created on hosted staging just for tests.
- Verify: focused shell/i18n/E2E/endpoint, 320px and WebKit.
- Commit: `test(web): expose automatic and manual bet settlement`.

### 11. Full gate and Frankfurt staging

- `pnpm run verify:staging`, product boundary, SQL rollback smoke, Edge graph/runtime and
  Cloudflare artifact verifier all green. Inspect exactly pending additive migrations and owner
  data/Custom/Running audit before any staging schema change. Record Edge/Worker rollback
  versions, migrate Frankfurt, deploy Edge and Worker, verify hosted API/owner/settlement/PWA;
  clean test drafts in `finally`, do not create financial ledger test records remotely. Rollback
  on deployment or hosted gate failure. Retain physical iPhone zoom acceptance as an unresolved
  owner-only gate from the preceding phase; no false claim of absolute zoom lock.
- Review secrets, jobs, provider request count, rollback/restore, no production and no push.
- Commit only if every automated and owner-only acceptance gate actually passes:
  `docs: record evidence-gated bet settlement staging acceptance`.

Stop at the first RED/GREEN/review/rollback failure. A manual-required outcome is safe behavior,
not a test failure; silent financial guesses are forbidden.

## Slice 11 execution evidence — 2026-09-17

- Local release/staging verification is green: 178 Vitest files / 1,116 tests, integration and
  endpoint suites, Structured Add Bet and settlement browser gates, Chromium/WebKit PWA checks,
  lint, typecheck, audits and static build. The automatic-settlement PostgreSQL smoke exercised
  constraints, rollback and cleanup. Edge build/module graph/runtime auth and Postgres scopes pass.
  The reviewed Cloudflare artifact contains 74 production modules, 729,317 bytes total, with a
  214,119-byte largest file.
- Exactly three additive migrations (`optional_pre_bet_psychology`, `running_goal_threshold`, and
  `automatic_settlement_review`) were pending and are now applied in Frankfurt. All 18 local and
  remote migration versions match. The pre/post audit remains one pre-existing draft, zero bets,
  zero ledger entries, zero Running records, zero Custom creates and zero legacy emotions.
- Candidate Edge v25 is ACTIVE with SHA-256
  `395bf413b558ff3148b4db6398bef14e0f589f86bcc05e2129109b3861519296`. Cloudflare Worker
  `8805cccd-0655-412d-a498-4538e2252261` serves 100% of staging traffic. The hosted owner flow
  binds a real canonical match, confirms locked teams, round-trips and cleans a structured draft,
  verifies detail/manual-review fixtures, auth/logout/redaction and retains no test owner data.
  The aggregate owner/scheduler gate passed at `2026-09-17T01:31:09.203Z`; all three controlled
  deliveries returned valid fresh/refreshed outcomes. Hosted 320px/390px/landscape and cache-v15
  checks pass in Chromium and WebKit; cold/install/reopen and Chromium offline startup pass.
- Rollback was exercised with jobs at zero. Worker
  `dcf92724-1f08-4c3e-b877-3d6cebba2137` and the pre-phase Edge bundle from commit `5007fb2`
  were restored; Edge v24 reproduced the recorded baseline SHA-256
  `a43b5a3d8acbd9306ee85b8f7fbbda115d1fd1b956d43082ca863ba158e293db`, and gateway/API smoke
  remained green on the additive schema. Candidate Edge/Worker were then restored, owner flow
  passed again, three jobs were re-enabled, and data counts were unchanged.
- Operational finding: `.secrets/cloudflare.bootstrap.secret.env` contained an obsolete gateway
  token. The first candidate Worker therefore returned 401 from Edge and was rejected by smoke.
  Deployment was corrected using the current token source in `.secrets/edge.staging.env`; no token
  value or digest is committed. Future staging deployment must not use the obsolete bootstrap file.
- Remaining owner-only gate: desktop WebKit cannot certify an installed iPhone Home Screen app.
  Focus, double-tap, pinch, rotation and close/reopen still require physical-device confirmation.
  The closeout commit remains withheld until that check passes; zoom control remains best-effort.

## Owner-feedback correction — installed PWA cache

- Owner feedback proved the installed iPhone still rendered the earlier Structured Add Bet shell.
  Direct SHA-256 comparison showed the staging origin already served the current local shell,
  catalog and app-shell bytes; the deployment itself was present. The defect was reuse of
  `miraichi-shell-v15-structured-add-bet`, so an existing installation had no service-worker/cache
  generation change to trigger delivery of the later UI.
- RED: the service-worker test expected v16 while install still opened v15. GREEN: use
  `miraichi-shell-v16-evidence-settlement`, delete v15 on activation, and update smoke/PWA/browser
  gates. `verify:staging` remains green at 178 files / 1,116 tests; Cloudflare artifact verification
  passes 74 modules / 729,318 bytes.
- Worker `96f8a771-4419-4c67-9c67-4760dff43749` now serves 100% of staging traffic. Static/API
  smoke, hosted Chromium/WebKit cache-v16 checks and the complete Structured Add Bet staging flow
  pass. Edge v25 and all persistence remain unchanged. The prior Worker
  `8805cccd-0655-412d-a498-4538e2252261` remains the rollback baseline.
- The owner's earlier five-point zoom result validates the unchanged zoom controls, but it was
  observed on the stale v15 shell. Final closeout still requires confirmation that close/reopen
  upgrades the installed app and displays the corrected Add Bet/corner UI.

## Owner-feedback correction — retain Manual Add

- The owner clarified that only Today Quick Add is unnecessary. Removing Manual Add from Bets was
  a requirement error because unlisted lower-league matches still need entry.
- RED covered an absent Bets Manual Add action, cached manual sessions, locked manual team fields,
  and API rejection of a structured `manual:*` draft/bet without `matchId`.
- GREEN restores Manual Add only in Bets. Manual and unlinked legacy-draft sessions reset and allow
  Home/Away editing; scoped sessions remain bound to one canonical `matchId` with readonly teams.
  The API strictly validates manual group IDs and team names, retains structured market validation,
  and never accepts a `matchId` on a manual record.
- PWA cache advances to `miraichi-shell-v17-manual-add`. Frankfurt Edge v26 and Worker
  `fc867def-cd30-4237-978d-7090f068cb99` pass static/API smoke, hosted structured flow,
  Chromium/WebKit cache/layout checks, real scoped and manual draft round-trips, scheduler checks,
  and cleanup audit. The audit retains one pre-existing draft and zero bet/ledger/test records.
- Previous Edge v25 SHA `395bf413b558ff3148b4db6398bef14e0f589f86bcc05e2129109b3861519296`
  and Worker `96f8a771-4419-4c67-9c67-4760dff43749` remain the rollback baseline. No migration,
  push, or production action occurred.
