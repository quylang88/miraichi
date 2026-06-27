# Release Workflow

Steps for building, tagging, and releasing updates.

## Purpose
Ensures that deployment milestones are achieved safely and tracked.

## Status
- **Status**: Draft

## Scope
Directly plans versioning tags and release tasks.

## Release Steps
1. Load `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
2. Run `pnpm run verify:release`.
3. Deploy to staging only if staging targets are configured. Phase 5.11 uses Cloudflare Pages project `miraichi-staging` for web/PWA staging.
4. Run staging smoke checks and prepare phase closeout evidence.
5. For intermediate phases, recommend the next safe phase instead of entering formal owner-feedback or production promotion.
6. Enter final owner review only after all planned release phases are complete or explicitly removed from scope.
7. Wait for explicit owner approval at final release review.
8. Increment the version tag in CHANGELOG.md.
9. Compile and package app container images if the final release scope requires them.
10. Promote to production only after final owner approval.

## TODO / Next Steps
- [ ] Implement semantic-release workflow scripts.
