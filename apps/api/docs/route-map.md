# API Route Map

Backend HTTP endpoint layouts and definitions.

## Purpose
Exposes planned routing paths, query options, and response structures.

## Status
- **Status**: Active

## Scope
Maps all public, authenticated, and service-to-service endpoints in apps/api.

## Route Schema
- `POST /api/v1/auth/login` - Authenticate user credentials
- `GET /api/v1/competitions` - Fetch active sports competitions (generic response)
- `GET /api/v1/matches` - Get matches listing with dynamic filtering
- `POST /api/v1/bets` - Record user bets and audit logs
- `POST /api/v1/predictions` - Query model predictions for matches

## TODO / Next Steps
- [ ] Detail endpoint payloads and validator definitions.
