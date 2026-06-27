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

### Changed
- Promoted Phase 1 ADRs (ADR-0002, 0004-0011) to Accepted status and ADR-0003 to Proposed status based on project owner decisions.
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

## TODO / Next Steps
- [x] Review draft Phase 5.10 Add Bet Draft/Form State + Persistence Planning after docs hygiene closes.
- [x] Start Phase 5.11 Local-First Add Bet Draft Persistence Implementation Planning.
- [x] Owner review Phase 5.11 implementation plan before any code slice.
- [ ] Run Phase 5.11 integration-test boundary verification before staging or owner-feedback promotion.
