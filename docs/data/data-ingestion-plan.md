# Data Ingestion Plan

Workflows for scheduled sport data polling and saving.

## Purpose
Ensures that fixtures and match updates are fetched reliably.

## Status
- **Status**: Draft

## Scope
Directly outlines ingestion tasks in apps/worker and queue parameters.

## Ingestion Flow
1. **Fetch**: Workers call external endpoints using credentials in `.env`.
2. **Normalize**: Map specific feed structures into the shared generic football model.
3. **Save**: Update db records and invalidate Redis cache keys.

## TODO / Next Steps
- [ ] Detail API rate-limit strategies.
