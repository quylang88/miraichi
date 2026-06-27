# API Architecture Plan

Backend structure and design patterns for the Miraichi API.

## Purpose
Establishes system flows, data layers, caching strategies, and integration points for backend modules.

## Status
- **Status**: Active

## Scope
Directly governs backend codebase layouts, microservice contracts, and dependency injection patterns in apps/api.

## Guidelines
- Use clean architecture principles; isolate routing schemas from core business logic layers.
- Do not introduce database dependencies directly into prediction components.

## TODO / Next Steps
- [ ] Determine server language environment (TypeScript vs Go).
- [ ] Set up basic ORM schema template structure.
