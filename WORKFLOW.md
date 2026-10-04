# Workflow And Contribution Standards

## Lifecycle

All work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`:

`plan -> implementation plan -> TDD code slices -> integration -> staging -> owner feedback -> production -> maintenance`

`PROJECT_PLAN.md` is authoritative when active-phase documents disagree. A local pass is evidence, not production approval.

## Development Rules

- Use TypeScript-first source under `apps/`, `packages/`, and `scripts/`.
- Write a failing unit test before changing behavior.
- Keep provider-specific behavior behind a removable adapter.
- Keep competitions configurable; both club and national-team types are valid.
- Do not select a website source, add credentials, or change production infrastructure without explicit owner approval.
- Do not add automated picks, betting formulas, stake sizing, or calculated performance metrics.

## Verification

```bash
pnpm run verify:product-boundary
pnpm run verify:local
pnpm run test:integration
```

Run `pnpm run verify:release` before staging and `pnpm run verify:staging` immediately before a staging deployment.

## Git

- Preserve history; do not rewrite shared commits.
- Use Conventional Commits.
- Keep commits scoped and reviewable.
- Do not stage unrelated user changes.

## Documentation

Architectural changes require an ADR and source-of-truth updates. Historical details removed from the active tree remain recoverable from Git history.
