# Shared Package

Common TypeScript types, utility libraries, and helper methods.

## Purpose
Enforces domain standard interfaces, date parses, validation helpers, and mathematical utility functions.

## Status
- **Status**: Draft

## Scope
Shared monorepo helper libraries, data model type definitions, and core football schemas.

## Guidelines
- Types must maintain a competition-agnostic interface (e.g. `Competition`, `Season`, `Match` instead of `WorldCupMatch`).
- Utility functions must be pure and well-tested.

## TODO / Next Steps
- [ ] Export common validation types.
- [ ] Establish directory configurations.
