# Testing & Verification Workflow

Procedures for verifying code updates.

## Purpose
Establishes testing patterns for units, integration layers, and system APIs.

## Status
- **Status**: Draft

## Scope
Directly plans tests suites layout and runtime checks.

## Guidelines
- Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` for test gates.
- Write a failing unit test before each new feature, bug fix, refactor, or behavior change.
- Unit tests run with Vitest through `pnpm run test:unit`.
- Coverage evidence runs through `pnpm run test:unit:coverage`; new or modified behavior targets 80% coverage as a review gate.
- Integration verification runs through `pnpm run test:integration`.
- Release verification runs through `pnpm run verify:release`.
- Isolate test mock databases from staging/production configurations.
- Placeholder pass-only scripts such as `node -e "... pass"` are forbidden.

## TODO / Next Steps
- [ ] Define code coverage target ratios (e.g. 80% coverage).
