# Application Boundaries

Separation of concerns and interfaces between monorepo apps.

## Purpose
Enforces boundaries so that code under `apps/` is decoupled.

## Status
- **Status**: Active

## Scope
Directly governs apps/api, apps/web, apps/local-ai, and apps/worker code interfaces.

## Boundary Rules
1. **Web vs API**: Web client interacts only with public API gateway routes.
2. **API vs Local AI**: API requests predictions from Local AI through HTTP request payloads, never accessing AI models/python scripts directly.
3. **API vs Worker**: State is shared via shared databases and Redis queues.

## TODO / Next Steps
- [ ] Implement middleware checkers to block cross-boundary calls.
