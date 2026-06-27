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
3. Deploy to staging only if staging targets are configured. Phase 5.11 uses Cloudflare Pages project `miraichi-web-staging` for web/PWA staging.
4. Run staging smoke checks and prepare owner review evidence.
5. Wait for explicit owner approval.
6. Increment the version tag in CHANGELOG.md.
7. Compile and package app container images.
8. Promote to production only after owner approval.

## TODO / Next Steps
- [ ] Implement semantic-release workflow scripts.
