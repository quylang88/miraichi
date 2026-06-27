# GitHub Actions Plan

Workflow definitions and stages configuration.

## Purpose
Establishes the steps for building and testing PRs automatically.

## Status
- **Status**: Draft
- **Review Status**: Phase 6 check-only CI workflow implemented; deployment automation still blocked.

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

## Phase 6 Check-Only Workflow

The first CI workflow is check-only. It runs lifecycle verification, unit tests, syntax checks, typecheck, and guardrail audit.

It intentionally does not run Cloudflare deployment, does not reference Cloudflare secrets, and does not run production promotion.

## TODO / Next Steps
- [ ] Get owner decision on manual-only versus CI-triggered staging deployment.
- [x] Create a Phase 6 implementation plan before adding `.github/workflows/` YAML.
- [x] Add check-only `.github/workflows/ci.yml` without deploy or secret references.
- [ ] Keep staging deployment automation blocked until a separate owner-approved secret policy exists.
