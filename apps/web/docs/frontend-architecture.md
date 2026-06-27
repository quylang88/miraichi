# Frontend Architecture Plan

Technical guidelines and directory guidelines for the Miraichi web client.

## Purpose
Establishes the state management, routing system, and api fetching guidelines for client development.

## Status
- **Status**: Draft

## Scope
Governs directory layouts, component design patterns, and routing setups in apps/web.

## Guidelines
- Components should rely heavily on the design tokens and rules defined in packages/ui.
- Maintain strict modularity; isolate views from data adapters.
- New web client modules must be TypeScript-first. Add new components, services, config, shell modules, and tests as `.ts` / `*.test.ts`; keep `.js` only for existing legacy entrypoints or no-build runtime bridges with a documented reason.
- The current no-build development server may transpile web `.ts` modules for browser delivery, but source ownership remains TypeScript-first.

## TODO / Next Steps
- [ ] Determine core framework selection (Next.js vs Vite).
- [ ] Establish REST/GraphQL fetching patterns.
