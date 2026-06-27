# Pull Request Checklist

Requirements that must be met before code is merged.

## Purpose
Guarantees code quality, safety, and architectural compliance.

## Status
- **Status**: Draft

## Scope
Pull Request submission files reviews.

## Checklist Items
- [ ] `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` phase was followed.
- [ ] Each code slice has a unit test that failed before implementation and passed after.
- [ ] `pnpm run verify:local` passes.
- [ ] `pnpm run test:integration` passes only when this PR closes a large feature boundary or moves toward staging.
- [ ] Endpoint E2E is included only for large feature boundary completion, not for every small current-code slice.
- [ ] Intermediate phase closeout evidence is recorded before starting the next phase.
- [ ] Final owner approval is recorded before production promotion.
- [ ] Code builds without errors.
- [ ] All automated tests pass successfully.
- [ ] The change is competition-agnostic.
- [ ] Relative file links and code documentation are updated.

## TODO / Next Steps
- [ ] Automate this checklist in the GitHub PR template.
