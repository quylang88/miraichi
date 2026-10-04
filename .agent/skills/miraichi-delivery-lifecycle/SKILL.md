---
name: miraichi-delivery-lifecycle
description: Use when planning, coding, testing, staging, releasing, or maintaining Miraichi work, especially phase commands, source integration, owner review, or production promotion.
---

# Miraichi Delivery Lifecycle

## Core Rule

Use this sequence:

`plan -> implementation plan -> TDD code slice -> integration -> staging -> owner feedback -> production -> maintenance`

`PROJECT_PLAN.md` is authoritative for the active phase. No phase skips its exit gate.

## Required First Steps

1. Read this skill and `miraichi-project-guardrails`.
2. Inspect the active phase in `PROJECT_PLAN.md`.
3. Use the earliest safe phase for the requested work.
4. Use `miraichi-phase-transition-recommendation` at closeout.

## Phase Gates

| Command | Work | Exit gate |
| --- | --- | --- |
| `phase:plan` | Product research, source comparison, spec, ADR | Owner-approved boundary |
| `phase:implementation-plan` | Exact TDD slices | Each slice names files, failing test, implementation, verification |
| `phase:code-slice` | One behavior slice | Red test observed, minimal implementation, focused checks pass |
| `phase:integration-test` | Cross-module verification at a large feature boundary | `pnpm run verify:local` and `pnpm run test:integration` pass |
| `phase:staging` | Build, deploy, smoke | `pnpm run verify:staging`, deployment, and fresh smoke evidence |
| `phase:owner-feedback` | Final release review or explicit checkpoint | Explicit owner decision |
| `phase:production` | Production promotion | Release complete, staging green, rollback known, owner approval explicit |
| `phase:maintenance` | Post-release changes | Normal lifecycle still applies |

## Code And Test Policy

- Use `test-driven-development`; production behavior needs a failing test first.
- Unit tests are colocated as `*.test.{js,ts}`. New TypeScript tests use `*.test.ts`.
- Integration suites belong in `tests/integration/`; user-flow suites belong in `tests/e2e/`.
- New app modules must be TypeScript-first.
- The gradual TypeScript direction means tightening existing types, not adding tracked JavaScript source.
- A normal slice stops after focused/local checks. Run endpoint and full integration checks only at a large feature boundary.

## Required Commands

```bash
pnpm run verify:product-boundary
pnpm run verify:local
pnpm run test:integration
pnpm run verify:release
pnpm run verify:staging
```

Local verification is not staging evidence. Staging evidence is not production approval.

## Stop Conditions

Stop and report a blocker when the active phase cannot be inferred, a new source or infrastructure decision lacks owner approval, a required target is missing, verification fails, or the request crosses project guardrails.
