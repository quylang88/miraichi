# Data Ingestion Plan

Workflows for scheduled sport data polling and validation.

## Purpose
Ensures that fixtures and match updates are processed reliably.

## Status
- **Status**: Active

## Scope
Outlines ingestion task flow in `apps/worker` using mock provider sources.

## Ingestion Flow
1. **Fetch**: Read static local JSON mock fixtures. (No external API calls are made, and no real credentials or `.env` secrets are configured).
2. **Normalize**: Map mock JSON structures into the shared generic football domain model via provider-agnostic parser adapters.
3. **Verify**: Run quality checks against matches (e.g. non-negative scores, non-zero odds).
4. **Save**: Output to memory logs or temporary mock repositories. Production database storage, ORM mappings, and Redis caching mechanisms are strictly deferred until the storage ADR is accepted.

## TODO / Next Steps
- [ ] Detail API rate-limit strategies for future real integration.
- [ ] Implement parser adapters for local mock data files.
