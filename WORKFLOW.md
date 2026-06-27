# Workflow & Contribution Standards

Standard operating procedures for developers and AI agents working on Miraichi.

## Purpose
This document ensures consistency, quality, and seamless coordination between human engineers and AI subagents.

## Status
- **Status**: Active Governance

## Scope
Covers git branching, commit message formatting, code review procedures, agent execution rules, and handoff protocols.

## Core Workflows

### 0. Miraichi Delivery Lifecycle
- All real work follows `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
- The mandatory lifecycle is: plan -> implementation plan -> TDD code slice -> full integration -> staging -> owner feedback -> production -> maintenance.
- Agents must identify the active phase command before acting.
- `PROJECT_PLAN.md` is the current phase source of truth when root docs disagree.
- Local pass is not production approval; staging owner approval is required before production.

### 1. Task Creation Flow
- Tasks must begin with a clear goal statement.
- Large tasks must be broken down in a local `task.md` file in the agent workspace.

### 2. Git Branching Strategy
- Feature branches use: `feat/[agent-or-dev-name]/[short-description]`
- Fixes use: `fix/[agent-or-dev-name]/[issue-name]`
- Keep branches short-lived and clean.

### 3. Commit Convention
- Follow Conventional Commits format: `<type>(<scope>): <description>`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
  - Example: `feat(api): add competition schema validation`

### 4. Pull Request Checklist
- Code builds successfully.
- Tests pass.
- Architecture matches the competition-agnostic model.
- Docs are updated correspondingly.

### 5. Testing & Verification Workflow
- All code changes require TDD at the code-slice level.
- Run `pnpm run verify:local` before integration handoff.
- Run `pnpm run test:integration` before staging.
- Run `pnpm run verify:release` before staging or production promotion.
- Placeholder pass-only scripts such as `node -e "... pass"` are forbidden.

### 6. Release Workflow
- Incremental version bumps in changelog.
- Tagged releases in main branch after staging owner approval.
- Production promotion requires explicit owner approval after staging smoke checks.

### 7. Agent Handoff Workflow
- When a task requires capabilities outside an agent's domain, the agent must document the state and invoke the corresponding agent using the standard protocol defined in packages/agent-protocol.

### 8. Documentation Update Workflow
- Any architectural change must update relevant docs and ADRs.
- Docs must not contain hard-coded competition references.
- Documentation status must follow `docs/governance/DOCUMENT-STATUS-TAXONOMY.md`; do not promote non-ADR docs to `Accepted` without explicit owner approval evidence.

### 8.1 TypeScript Migration Workflow
- New implementation modules under `apps/*/src` and `packages/*/src` must be TypeScript-first.
- Existing JavaScript remains legacy until a specific migration slice names exact files, tests, and verification commands.
- Do not run a bulk JavaScript-to-TypeScript migration as cleanup.
- JavaScript is acceptable for existing runtime bridges, service workers, package entry bridges, and scripts when a compatibility reason is documented.

### 9. Phase 1 Architecture Planning Workflow
- Phase 1 changes are limited to Markdown documentation and decision records.
- Phase 1 must prefer Draft, Candidate, Option, and Open Question language.
- Phase 1 must not implement business logic, prediction algorithms, betting calculations, production schemas, secrets, or final technology choices.
- Architecture planning updates must run project guardrails, docs-maintainer review, and competition-agnostic review before completion.
- Later implementation work must be backed by accepted ADRs or explicitly approved planning decisions.

## TODO / Next Steps
- [ ] Implement automated linting checks for branch names and commit messages.
