# Workflow & Contribution Standards

Standard operating procedures for developers and AI agents working on Miraichi.

## Purpose
This document ensures consistency, quality, and seamless coordination between human engineers and AI subagents.

## Status
- **Status**: Draft

## Scope
Covers git branching, commit message formatting, code review procedures, agent execution rules, and handoff protocols.

## Core Workflows

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
- All code changes require manual or automated validation.
- Run tests locally before opening a pull request.

### 6. Release Workflow
- Incremental version bumps in changelog.
- Tagged releases in main branch.

### 7. Agent Handoff Workflow
- When a task requires capabilities outside an agent's domain, the agent must document the state and invoke the corresponding agent using the standard protocol defined in packages/agent-protocol.

### 8. Documentation Update Workflow
- Any architectural change must update relevant docs and ADRs.
- Docs must not contain hard-coded competition references.

## TODO / Next Steps
- [ ] Implement automated linting checks for branch names and commit messages.
