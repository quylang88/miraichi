# ADR-0001: Monorepo Workspace Structure

- **Status**: Accepted
- **Date**: 2026-06-23
- **Author**: Antigravity

## Context
We need to manage multiple modules (web interface, backend api gateway, local predictions pipeline, background scheduled processes) while sharing domain entities, UI elements, and developer rules. Separating these into different repositories makes coordination, code sharing, and agent handoffs slow and complex.

## Decision
We will establish a single monorepo workspace with exactly 4 main root-level folders:
- `apps/` - Deployable services.
- `packages/` - Shareable configuration libraries.
- `docs/` - System and product guidelines.
- `ops/` - CI/CD and monitoring config files.

## Consequences
- **Gains**: Single source of truth, simplified dependency sharing between packages and apps, standard lint rules.
- **Costs**: Larger checkout size, requires careful namespace boundary tracking to prevent circular dependencies.
