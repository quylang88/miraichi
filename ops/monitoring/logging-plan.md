# System Logging Strategy

Structured logging guidelines, levels, and sanitizers.

## Purpose
Establishes standard format (JSON) and levels for application logs.

## Status
- **Status**: Draft
- **Review Status**: Phase 6 planning active; implementation pending owner approval.

## Scope
Directly plans runtime logging across all monorepo apps.

## Guidelines
- Format: `{"timestamp": "...", "level": "info", "message": "...", "app": "api"}`.
- Sanitizer middleware must filter out auth headers.

## TODO / Next Steps
- [ ] Define no-secret log sanitization checks before choosing logging packages.
