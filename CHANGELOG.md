# Changelog

Record of changes and releases in the Miraichi monorepo.

## Purpose
This document tracks all user-facing changes, features, bug fixes, and architectural adjustments.

## Status
- **Status**: Draft

## Scope
Includes all directories and apps under this monorepo.

## Guidelines
- Changes are categorized under: Added, Changed, Deprecated, Removed, Fixed, Security.
- Follow semantic versioning rules once a public release is tagged.

## [Unreleased]

### Added
- Created monorepo directory layout (`apps/`, `packages/`, `docs/`, `ops/`).
- Initialized configuration defaults (`.gitignore`, `.editorconfig`, `.gitattributes`, `.env.example`).
- Added root and module-level architectural guidelines and documentation drafts.
- Added Phase 0 Completion Report ([PHASE-0-COMPLETION-REPORT.md](file:///c:/CODE/miraichi/docs/decisions/PHASE-0-COMPLETION-REPORT.md)).
- Added Phase 1 architecture planning package and ADR-0002 for architecture discovery.

### Changed
- Promoted Phase 1 ADRs (ADR-0002, 0004-0011) to Accepted status and ADR-0003 to Proposed status based on project owner decisions.
- Updated root architecture planning documents (README, ARCHITECTURE.md, PROJECT_PLAN.md, ROADMAP.md) to reflect approved Phase 1 status.
- Added Phase 1 Completion Review ([PHASE-1-COMPLETION-REVIEW.md](file:///c:/CODE/miraichi/docs/decisions/PHASE-1-COMPLETION-REVIEW.md)) executing the milestone verification.
- Added Phase 1 Completion Report ([PHASE-1-COMPLETION-REPORT.md](file:///c:/CODE/miraichi/docs/decisions/PHASE-1-COMPLETION-REPORT.md)) summarizing Phase 1 milestones and status.
- Added Phase 1 Decision Backlog ([PHASE-1-DECISION-BACKLOG.md](file:///c:/CODE/miraichi/docs/decisions/PHASE-1-DECISION-BACKLOG.md)) tracking unresolved architectural decisions.
- Revised Phase 5.7A PWA preview direction to Black Apple Ledger, superseding the Modern Premium green-glow direction and keeping the preview static, generic, and formula-free.
- Added Phase 5.7A provisional UI closure documentation, clarifying that the Black Apple Ledger preview is temporary, Phase 5.7B remains deferred, and settings/language planning is future work.

## TODO / Next Steps
- [ ] Version and release the application skeleton (Milestone 2).
