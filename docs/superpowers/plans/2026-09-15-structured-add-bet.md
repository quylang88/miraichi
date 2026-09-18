# Structured Add Bet and PWA zoom quality-up

Owner instruction: 2026-09-15. Work sequentially through reviewed TDD slices and create one local
commit only after each slice is green and the diff is clean. Delivery includes the existing
Frankfurt staging environment. Push and production promotion are not approved.

## Product contract

- New bets use structured `1X2`, goals over/under, handicap, corners over/under, or running
  selections. Custom is unavailable for new entry; legacy records remain readable.
- Standard markets record a period and canonical selection code. Line markets require a bounded
  quarter-step line. The server derives the stored display label.
- Running is a distinct entry choice with HT, FT, or fixed 15-minute windows. It records the
  score and minute at placement, using an exact fresh LIVE match when available and explicit manual
  context otherwise.
- New emotions are calm, excited, and tilted; calm is the form default. Existing detailed negative
  emotions normalize to tilted.
- Manual and quick add always start clean. Scoped add starts clean and then binds its selected match;
  draft editing is the only restore path. The duplicate manual-match summary is removed and the two
  teams remain on one Home vs Away row.
- The installed PWA applies the strongest practical page-level zoom constraint requested by the
  owner, while documenting that iOS can override page constraints and that this reduces accessibility.

## Sequential TDD slices

1. Shared market catalog, structured types, validation, canonical labels, and presets.
2. Additive PostgreSQL columns, constraints, persistence mapping, and backup round-trip.
3. API acceptance of structured draft and ongoing-bet payloads.
4. Fresh Add Bet sessions, removal of duplicate match summary, and one-row team layout.
5. Guided standard-market controls with dependent-field resets and strict manual line parsing.
6. Running HT/FT/15-minute live-context resolution and manual fallback.
7. Strict structured creation and removal of Custom from new-entry/API paths.
8. Three-state emotion contract, migration, reporting, and default UI value.
9. PWA viewport/gesture constraints, 16px mobile controls, and an atomic shell-cache advance.
10. Committed deterministic local/hosted E2E gate, observed RED against the old staging candidate.
11. Complete local gates, reviewed Frankfurt migrations and deploy, hosted verification,
    rollback/restore, and evidence closeout.

Each slice follows RED -> GREEN -> focused verification -> requirement/code/test review -> finding
correction -> repeated verification -> `git diff --check` -> local commit. A failing or unresolved
slice stops the sequence. Staging test records are cleaned in `finally`; no provider scope, picks,
stake recommendation, ROI, CLV, production action, or destructive owner-data operation is added.

## Slice 11 staging evidence — automated gates complete, physical iPhone pending

- `pnpm run verify:staging` passes 171 unit files / 1,040 tests and every integration, endpoint,
  structured browser, PWA, lint, typecheck, audit and build gate. Local PostgreSQL, Edge runtime,
  Edge graph and the 72-module Cloudflare artifact checks pass.
- Frankfurt had exactly the two reviewed pending migrations. Both are applied; local and remote now
  match all 15 tracked versions. No Custom or legacy-emotion data required destructive handling.
- Edge version 22 is ACTIVE with SHA-256
  `a43b5a3d8acbd9306ee85b8f7fbbda115d1fd1b956d43082ca863ba158e293db`. Worker
  `dcf92724-1f08-4c3e-b877-3d6cebba2137` serves 100% with cache
  `miraichi-shell-v15-structured-add-bet`.
- Hosted structured Add Bet, real structured draft persistence/cleanup, static/API smoke,
  Chromium/WebKit layout and cache, owner/auth/redaction, match detail and scheduler checks pass.
  The post-restore aggregate gate completed at `2026-09-15T07:56:15.805Z` with all three scheduler
  outcomes `fresh`.
- Rollback restored Worker `79fac467-a2d0-43d8-b25a-6c06ef89feaf` and the Edge v19 source from
  commit `674176a` as v21. Its bundle SHA matched
  `de1351239a5cb1a725186b0b1acb6e227e487960a258b0c7488c22bb6a593491`; direct denial, gateway
  health and nine baseline static/API checks passed. Candidate Edge, Worker and three jobs were
  restored before rerunning the current gate.
- Final staging audit retains one pre-existing draft and creates no E2E draft, bet, ledger or
  Running record. Four Vault names and three scheduler jobs remain intact.
- The agent cannot perform the required physical installed-iPhone Home Screen gestures. Until the
  owner confirms focus, double-tap, pinch, rotation and close/reopen behavior, Slice 11 remains open
  and the final `docs: record structured add bet staging acceptance` commit is intentionally not
  created. Push and production remain unapproved.
