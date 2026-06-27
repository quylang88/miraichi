# Changelog

Record of changes and releases in the Miraichi monorepo.

## Purpose
This document tracks all user-facing changes, features, bug fixes, and architectural adjustments.

## Status
- **Status**: Active Log

## Scope
Includes all directories and apps under this monorepo.

## Guidelines
- Changes are categorized under: Added, Changed, Deprecated, Removed, Fixed, Security.
- Follow semantic versioning rules once a public release is tagged.

## [Unreleased]

### Added
- Added Miraichi delivery lifecycle enforcement through `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`, real Vitest unit tests, lifecycle verification, and release gate scripts.
- Created monorepo directory layout (`apps/`, `packages/`, `docs/`, `ops/`).
- Initialized configuration defaults (`.gitignore`, `.editorconfig`, `.gitattributes`, `.env.example`).
- Added root and module-level architectural guidelines and documentation drafts.
- Added Phase 0 Completion Report ([PHASE-0-COMPLETION-REPORT.md](file:///c:/CODE/miraichi/docs/decisions/PHASE-0-COMPLETION-REPORT.md)).
- Added Phase 1 architecture planning package and ADR-0002 for architecture discovery.
- Added Phase 5.10 Add Bet Draft/Form State and Persistence Planning docs for owner review.
- Added document status taxonomy and docs status hygiene review to prevent fake `Accepted` promotions.
- Completed document status hygiene slices for Phase 1, Phase 3, Phase 4, app/package docs, and ops docs.
- Added Miraichi phase transition recommendation skill so phase closeouts must name the next safe phase and owner questions with recommendations.
- Added Phase 5.11 local-first Add Bet draft persistence contracts, form-state helpers, memory and IndexedDB adapters, and versioned draft backup/import JSON helpers with conflict rejection.
- Added Phase 5.11 integration review evidence after local and integration gates passed.
- Selected Cloudflare Pages as the Phase 5.11 free web/PWA staging target and added static export support for `apps/web`.
- Updated Miraichi lifecycle policy so intermediate phases close with evidence and a next-phase recommendation, while formal owner-feedback and production promotion are deferred until final release.
- Added `phase:quality-up ui-ux-improve` lifecycle support for owner-requested post-staging UI/UX cleanup before phase closeout or final release.
- Added Phase 5.12 owner-requested shell quality-up review with local, release, static artifact, and browser QA evidence.
- Added local Cloudflare Pages staging deploy support through `scripts/deploy-staging-local.ps1`, `.env.local`, and `pnpm run deploy:staging:local`.
- Added Phase 5 closeout review with staging redeploy evidence and Phase 6 recommendation.
- Added Phase 6 Testing/Deployment Hardening planning package under `ops/`.
- Added Phase 6 CI/CD and Staging Smoke Automation implementation plan with TDD slices for smoke-check script, check-only CI workflow, docs updates, and verification.
- Added skill guidance requiring concise chat summaries after implementation plan creation instead of pasting long plans inline.
- Added repeatable staging smoke-check script and `pnpm run smoke:staging`.
- Added Phase 6 smoke-check script review evidence.
- Added check-only GitHub Actions CI workflow for lifecycle, unit, syntax, typecheck, and audit gates.
- Added owner-approved Phase 6 repo-wide JavaScript-to-TypeScript migration review evidence.
- Added Phase 6 TypeScript Strictness Hardening implementation plan to convert TypeScript source migration into enforced source-level type safety.
- Added Type-safety audit gate script (`scripts/type-safety-audit.ts`) and strictness policy tests (`scripts/typescript-strictness-policy.test.ts`).
- Added strictly-typed contracts, validators, and builders for Local AI prediction and API route boundaries, completely eliminating explicit `any` and `@ts-ignore` suppressions from source.

### Changed
- Promoted Phase 1 ADRs (ADR-0002, 0004-0011) to Accepted status and ADR-0003 to Proposed status based on project owner decisions.
- Updated `tsconfig.base.json` to enable strict compiler options (`strict`, `noImplicitAny`, `useUnknownInCatchVariables`, `exactOptionalPropertyTypes`) and resolved all type issues across scripts and modules.
- Integrated `audit:type-safety` as a required local check in the `verify:local` script pipeline.
- Updated root architecture planning documents (README, ARCHITECTURE.md, PROJECT_PLAN.md, ROADMAP.md) to reflect approved Phase 1 status.
- Added Phase 1 Completion Review ([PHASE-1-COMPLETION-REVIEW.md](file:///c:/CODE/miraichi/docs/decisions/PHASE-1-COMPLETION-REVIEW.md)) executing the milestone verification.
- Added Phase 1 Completion Report ([PHASE-1-COMPLETION-REPORT.md](file:///c:/CODE/miraichi/docs/decisions/PHASE-1-COMPLETION-REPORT.md)) summarizing Phase 1 milestones and status.
- Added Phase 1 Decision Backlog ([PHASE-1-DECISION-BACKLOG.md](file:///c:/CODE/miraichi/docs/decisions/PHASE-1-DECISION-BACKLOG.md)) tracking unresolved architectural decisions.
- Revised Phase 5.7A PWA preview direction to Black Apple Ledger, superseding the Modern Premium green-glow direction and keeping the preview static, generic, and formula-free.
- Added Phase 5.7A provisional UI closure documentation, clarifying that the Black Apple Ledger preview is temporary, Phase 5.7B remains deferred, and settings/language planning is future work.
- Added Phase 5.9 Production PWA Shell implementation with TypeScript-first shell modules, five approved primary tabs, shell-only settings/i18n stubs, production-baseline Black Apple Ledger UI structure, retired preview route, concise tab headers, and expanded PWA verification.
- Added lifecycle, guardrail, workflow, and frontend docs rules requiring new app modules to be TypeScript-first unless they are explicit legacy/runtime bridges.
- Updated root phase docs to run document status hygiene before Phase 5.10 and keep Phase 5.11 persistence implementation gated behind owner approval.
- Recorded owner approval of Phase 5.10 Add Bet Draft/Form State + Persistence Planning and gated Phase 5.11 to implementation planning before code.
- Added Phase 5.11 Local-First Add Bet Draft Persistence implementation plan with TDD slices for shared contracts, form state, memory adapter, IndexedDB adapter, and backup helpers.
- Recorded Phase 5.11 staging closeout evidence and deferred formal owner-feedback/production until all planned release phases are complete.
- Implemented Phase 5.12 shell quality-up cleanup locally: removed top shell status sections, changed Today date tile to current date, removed redundant choose-match CTA, switched Matches icon to stadium style, and trimmed unnecessary sample rows.
- Recorded Phase 5.12 Cloudflare Pages staging redeploy and smoke evidence, then closed Phase 5 with `phase:plan Phase 6 Testing/Deployment Hardening` as the recommended next command.
- Started Phase 6 planning with CI/CD, staging hardening, smoke-check automation, security/secrets audit, rollback, and monitoring workstreams.
- Recorded owner approval to move Phase 6 from planning into implementation planning while keeping code slices gated behind owner review.
- Implemented Phase 6 staging smoke-check script with TDD and kept JS-to-TS migration as a separate required slice.
- Implemented Phase 6 CI check workflow with TDD and kept Cloudflare deployment automation blocked.
- Migrated tracked implementation source under `apps/`, `packages/`, and `scripts/` from JavaScript to TypeScript, added `tsx` runtime wiring, and preserved browser-facing `.js` compatibility URLs.
- Tightened lifecycle, guardrail, workflow, module-map, and frontend docs so new tracked implementation source stays TypeScript-first after the repo-wide migration.
- Deferred Phase 6 staging until TypeScript strictness hardening code slices add an audit gate, remove explicit `any`, and enable stricter compiler flags.

## TODO / Next Steps
- [x] Review draft Phase 5.10 Add Bet Draft/Form State + Persistence Planning after docs hygiene closes.
- [x] Start Phase 5.11 Local-First Add Bet Draft Persistence Implementation Planning.
- [x] Owner review Phase 5.11 implementation plan before any code slice.
- [x] Run Phase 5.11 integration-test boundary verification before staging.
- [x] Run Phase 5.11 staging gate and closeout evidence before the next phase.
- [x] Create/link Cloudflare Pages project `miraichi-staging`, deployment token, Pages URL, and smoke-check evidence.
- [x] Complete `phase:quality-up ui-ux-improve Phase 5.12 Owner Requested Shell Cleanup` staging redeploy.
- [x] Close Phase 5 with staging smoke evidence and recommend Phase 6 planning.
- [x] Start `phase:plan Phase 6 Testing/Deployment Hardening` only after Phase 5 closeout.
- [x] Owner review Phase 6 Testing/Deployment Hardening Plan before implementation planning.
- [x] Create `phase:implementation-plan Phase 6 CI/CD and Staging Smoke Automation`.
- [x] Owner review Phase 6 CI/CD and Staging Smoke Automation implementation plan before `phase:code-slice`.
- [x] Complete `phase:code-slice Phase 6 staging smoke-check script`.
- [x] Complete `phase:code-slice Phase 6 CI check workflow`.
- [x] Complete owner-requested `phase:code-slice Phase 6 repo-wide JavaScript-to-TypeScript migration`.
- [x] Create `phase:implementation-plan Phase 6 TypeScript Strictness Hardening`.
- [ ] Start `phase:code-slice Phase 6 type-safety audit gate`.
- [ ] Run `phase:staging Phase 6 hardened staging process` only after TypeScript strictness hardening passes local and integration verification.
