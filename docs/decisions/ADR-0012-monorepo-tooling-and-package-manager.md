# ADR-0012: Monorepo Tooling and Package Manager Selection

## Status
- **Status**: Accepted
- **Accepted Date**: 2026-06-23
- **Owner Approval**: Approved by project owner
- **Date**: 2026-06-23

## Context
Miraichi is structured as a monorepo containing multiple applications (under `apps/`) and shared modules (under `packages/`). For Phase 2 scaffolding to begin, a monorepo package manager must be selected to govern workspace dependency linking, script execution, and lockfile management.

## Decision
Miraichi will use **pnpm workspaces** for monorepo package management.

## Options Considered
* **npm workspaces**: Standard Node.js package manager workspaces. Good for simplicity, but slower and less efficient with disk usage and duplicate dependency versions.
* **yarn workspaces**: Well-known workspace manager, but yarn configuration overhead is relatively high and version managers have fragmented behaviors.
* **pnpm workspaces**: Uses a content-addressable store to save disk space and speed up installations. Strict dependency linking prevents apps from importing undeclared transient dependencies, guaranteeing cleaner boundary isolation.

## Rationale
1. **Fits Monorepo Layout**: Natively supports the current `apps/*` and `packages/*` folder organization.
2. **Strict Workspace Dependency Linking**: Solves typing and import linkage between backend services and UI packages without requiring complex manual builds.
3. **Execution Consistency**: Unifies dev running and testing commands (e.g., `pnpm --filter` patterns) across developer environments and automated execution agents.
4. **Separation of Concerns**: Allows lockfile and symlink configuration without forcing frontend/backend library choices prematurely.

## Consequences
* Future scaffold steps will create a root `package.json` and a `pnpm-workspace.yaml` file.
* Future scaffold steps will add individual `package.json` configurations inside `apps/*` and `packages/*`.
* Development processes must use `pnpm` rather than `npm` or `yarn` (e.g. `pnpm install`, `pnpm dev`).
* Developer agents must not add arbitrary dependencies without a corresponding accepted ADR or direct project owner approval.

## Explicit Exclusions
This ADR selection does not choose:
* The frontend UI library (React, Svelte, etc.).
* The backend API server framework (Express, Nest, etc.).
* The database engine (SQLite, PostgreSQL, Mongo, etc.).
* The ORM or database driver libraries.
* Production schemas or database config variables.
* Sports-prediction or betting-calculation algorithms.

## Implementation Status
- **Implementation status**: Not started
