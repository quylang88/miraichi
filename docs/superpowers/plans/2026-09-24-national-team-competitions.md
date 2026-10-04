# National-Team Competition Coverage — Maintenance Plan

## Scope

Extend the existing owner-approved FotMob current-edition registry from 50 club competitions to a
provider-neutral mix of club and national-team competitions. Add only editions verified on
2026-09-24 as current, active, or concretely scheduled. Preserve the historical-season hard stop,
owner-only boundary, terminal-only publication, and deployment/promotion gates.

## TDD slices

1. Registry identity and edition semantics
   - RED: expect 14 national-team entries, exact provider IDs, verification date, and explicit
     non-annual edition windows.
   - GREEN: add national-team identities and FotMob bindings without adding fake SportScore IDs.
   - Verify: registry and TypeScript tests.
2. Hydration planner
   - RED: Asian Cup 2027 must plan as canonical `2027`, not be relabelled `2026`.
   - GREEN: resolve an optional verified current-edition override before generic season-cycle logic.
   - Verify: planner, registry, season integration tests.
3. UI ordering
   - RED: national-team competitions must be known to the shared popularity lookup and major
     current competitions must not fall behind secondary club leagues.
   - GREEN: merge the 14 entries into the shared/config rankings with deterministic sequential ranks.
   - Verify: web ordering and live-adapter label tests.
4. Closeout
   - Record source coverage and exclusions.
   - Run product-boundary, local verification, and season integration gates.
   - Do not push or promote production. Hydration/deployment requires a later explicit owner amendment.

## Delivery amendment and evidence

The owner subsequently authorized Frankfurt staging deployment, hosted verification, and a local
commit, while leaving push and production promotion unapproved.

- RED was observed for the missing 14 registry entries, missing current-edition override, and
  missing popularity entries. The first full local gate also exposed two hard-coded 45-edition
  expectations; both were updated to the verified 59-edition boundary.
- `pnpm run verify:staging` passed 178 unit files / 1,165 tests, 55 season integration tests, all
  other integration/E2E/PWA gates, and the static build.
- Edge graph/runtime smoke and the 74-module Cloudflare artifact gate passed before deployment.
- The first hosted run deliberately failed because its researched upcoming match sample had already
  started. It was replaced with the verified scheduled UEFA Nations League A match Greece vs
  Netherlands on 2026-10-01; the complete hosted gate then passed at
  `2026-09-24T03:35:24.912Z`.
- Two bounded current scheduler deliveries completed all 59 checkpoints. Frankfurt serving data
  reached 12,236 matches / 59 competitions / 14 national-team competitions.
- Edge v27 and Worker `62fac25e-e956-426e-8778-6f81cdb4ca3e` are active. Edge v26 and Worker
  `fc867def-cd30-4237-978d-7090f068cb99` are retained as rollback references.
- No schema change, historical hydration, push, or production promotion occurred.

## Phase transition recommendation

The staging phase is complete. The earliest safe next phase is `phase:maintenance` for normal
24-hour current-edition revalidation and terminal-result operation. Production remains blocked
until the owner explicitly opens `phase:owner-feedback` and then approves `phase:production`.
