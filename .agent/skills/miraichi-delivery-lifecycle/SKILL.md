---
name: miraichi-delivery-lifecycle
description: Use when planning, coding, testing, staging, releasing, or maintaining Miraichi work, especially phase commands, feature execution, bug fixes, deployment gates, owner review, or production promotion.
---

# Miraichi Delivery Lifecycle

## Core Rule

Treat Miraichi like a real production project:

`plan -> implementation plan -> code slice with TDD -> full integration -> staging -> owner review -> production -> maintenance`

No phase may skip its exit gate. A fast shortcut that removes evidence is a broken workflow.

## Required First Steps

1. Read this skill.
2. Read `miraichi-project-guardrails`.
3. Check the active phase in `PROJECT_PLAN.md`; if another root doc disagrees, treat `PROJECT_PLAN.md` as the current source and flag the mismatch.
4. Decide the requested lifecycle phase from the user prompt. If no phase is explicit, choose the earliest safe phase.
5. When closing, reviewing, or handing off a phase, read `miraichi-phase-transition-recommendation` before giving the final next-phase recommendation.

## Phase Commands

| Command | Allowed work | Exit gate |
| --- | --- | --- |
| `phase:plan <feature>` | Product/architecture analysis, spec, ADR/doc updates only | Owner-approved spec or explicit next-step approval |
| `phase:implementation-plan <approved spec>` | Task breakdown into small TDD code slices | Every slice has exact files, failing unit test, implementation step, and verification command |
| `phase:code-slice <task>` | One small implementation slice | Failing unit test observed, minimal code written, unit test passes, relevant local checks pass; do not run integration or endpoint E2E unless this slice closes a large feature boundary |
| `phase:integration-test` | Full local and cross-boundary verification after a large feature boundary is complete | `pnpm run verify:local` and `pnpm run test:integration` pass |
| `phase:staging` | Staging deployment and staging smoke checks | `pnpm run verify:release` passes and staging target is configured; otherwise fail fast |
| `phase:owner-feedback` | Package staging evidence and owner feedback | Owner gives explicit approval or requested changes become new lifecycle work |
| `phase:production` | Production promotion | Staging smoke passed, owner approval is explicit, rollback path is known |
| `phase:maintenance <change>` | Bugfixes and extensions after release | Same lifecycle as normal work; no hotfix bypass |

## Mandatory Gates

### Before Coding

- Existing approved spec or implementation plan must exist, unless the user explicitly provides one in the prompt.
- Code work must use `test-driven-development`.
- Production code requires a failing unit test first.
- Business logic, prediction algorithms, betting calculations, schemas, secrets, and hard-coded competitions remain blocked without owner-approved ADRs.

### During Code Slices

- Implement exactly one behavior slice at a time.
- Write the failing unit test first and run it.
- Write the smallest implementation that passes.
- Run the package-specific test or `pnpm run test:unit`.
- Do not move to integration while any slice is unverified.
- Normal code slices stop at unit/local verification. Integration and endpoint E2E are milestone gates, not per-slice gates.

### Large Feature Boundary

A large feature boundary is a feature-complete milestone whose behavior crosses modules, routes, app surfaces, or runtime processes. Examples:

- one completed production tab such as `Today`, `Matches`, `Bets`, `Bankroll`, or `Miraichi`;
- a complete local AI training workflow;
- a complete LLM capability or prompt-routing workflow;
- a complete persistence adapter, import/export path, or endpoint-backed workflow.

Only after one of these boundaries is complete should the owner or agent enter `phase:integration-test` and run integration or endpoint E2E.

### Local Verification

Run:

```bash
pnpm run verify:local
```

This must include lifecycle verification, real unit tests, syntax linting, typecheck, and guardrail audit. Placeholder scripts such as `node -e "... pass"` are forbidden.

### Integration Verification

Run this only after a large feature boundary is complete, not after every code slice:

Run:

```bash
pnpm run test:integration
```

This must run the current phase and boundary checks, including API/local-AI integration and PWA verification.

### Release Verification

Run:

```bash
pnpm run verify:release
```

Do not deploy to staging unless it passes.

## Staging And Production

- If no staging target is configured, stop and report the missing target. Do not pretend a deploy happened.
- Staging must produce an owner review pack: changed scope, test evidence, staging URL or explicit missing-target reason, known risks.
- Production requires explicit owner approval after staging. Local pass alone is not production approval.
- Maintenance and feature expansion must start again at `phase:plan` or `phase:code-slice`, depending on whether the owner already approved the exact change.

## Test Policy

- Unit tests must use the real test runner.
- Unit tests are colocated beside source as `*.test.{js,ts}`.
- New tests for TypeScript modules must use `*.test.ts`.
- Integration suites belong in `tests/integration/` unless an existing `scripts/*integration*` verifier is intentionally kept as an orchestrated phase check.
- E2E browser or user-flow suites belong in `tests/e2e/`.
- Miraichi uses gradual TypeScript adoption. Do not migrate the whole repo in one pass; prefer TypeScript first for shared contracts, config, validators, and pure domain helpers.
- New app modules must be TypeScript-first.
- New app/package implementation modules must be TypeScript-first. Existing JavaScript files may stay JavaScript until an approved migration slice, but new `apps/*/src` and `packages/*/src` components, services, config, validators, pure helpers, contracts, and tests must use `.ts` / `*.test.ts` unless the file is a legacy runtime bridge with a documented reason.
- A JavaScript migration slice must name the exact files being migrated, the tests that prove behavior did not change, and the verification command. Do not rename `.js` files to `.ts` as opportunistic cleanup.
- New or modified behavior needs meaningful unit coverage, not only integration smoke coverage.
- Coverage target for new/changed code is 80% as a review gate. Do not fake global repo coverage while legacy files are still untested.
- Integration tests do not replace unit tests.
- Integration and endpoint E2E are reserved for large feature boundary completion. A normal current-code change only needs the failing unit test, the passing unit test, and relevant local checks.

## Stop Conditions

Stop and ask or report a blocker when:

- The active phase is unclear and cannot be inferred safely.
- Required owner approval is missing.
- A staging or production target is missing.
- A verification command fails.
- Implementing the request would cross a guardrail boundary.
