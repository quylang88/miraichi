# GitHub Actions Plan

Workflow definitions and stages configuration.

## Purpose
Establishes the steps for building and testing PRs automatically.

## Status
- **Status**: Draft
- **Review Status**: Phase 6 planning active; implementation pending owner approval.

## Scope
Directly plans the YAML pipeline configurations under `.github/workflows/` (when implemented).

## Pipeline Stages
1. **Lifecycle**: Run `pnpm run verify:lifecycle`.
2. **Unit**: Run `pnpm run test:unit`.
3. **Syntax**: Run `pnpm run lint`.
4. **Typecheck**: Run `pnpm run typecheck`.
5. **Audit**: Run `pnpm run audit`.
6. **Integration**: Run `pnpm run test:integration` only for large-boundary, staging, or release branches.
7. **Staging Build**: Run `pnpm run verify:staging` before any staging deployment.

Do not add Cloudflare deployment from CI until owner-approved secret handling is explicit.

## TODO / Next Steps
- [ ] Get owner decision on manual-only versus CI-triggered staging deployment.
- [ ] Create a Phase 6 implementation plan before adding `.github/workflows/` YAML.
