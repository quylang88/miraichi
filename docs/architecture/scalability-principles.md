# Scalability Principles

Standards for horizontal scaling, database queries, and caching.

## Purpose
Ensures that the app handles high concurrency during match events.

## Status
- **Status**: Draft

## Scope
Defines data structures, caching layers, and worker queue scalability guidelines.

## Guidelines
- Cache match odds responses under Redis using expiring keys.
- Read-heavy queries (e.g. fixtures listings) must rely on database index keys.

## TODO / Next Steps
- [ ] Model stress-test performance scenarios.
