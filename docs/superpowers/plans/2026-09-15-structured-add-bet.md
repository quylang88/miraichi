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
