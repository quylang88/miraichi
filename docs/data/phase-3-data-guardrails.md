# Phase 3 Data Guardrails

Strict architectural and security boundaries governing Phase 3 development.

## Purpose
Prevents scope creep, ensures competition agnosticism, and keeps the project clean of premature production configurations.

## Status
- **Status**: Active Guardrails
- **Date**: 2026-06-23

## Core Guardrails

### 1. No Production Storage or ORM Dependencies
- **Forbidden**: Do not install or configure database clients (PostgreSQL, Redis, SQLite, MongoDB) or Object-Relational Mapping (ORM) libraries (Prisma, Drizzle, TypeORM, Sequelize, Mongoose).
- **Forbidden**: Do not create database migration folders, SQL script templates, or production database schemas.
- **Accepted Pattern**: Use shared memory stubs, JSON arrays, and simple mock repository adapters in `packages/shared` or local worker configurations.

### 2. No Live API Connectivity or Credentials
- **Forbidden**: Do not establish HTTP requests or socket connections to external live sports data providers.
- **Forbidden**: Do not add production secrets, credentials, API keys, or access tokens to `.env`, `.env.example`, or configurations.
- **Accepted Pattern**: Use local static JSON fixture files containing mock records for local execution.

### 3. Absolute Competition Agnosticism
- **Forbidden**: Do not hard-code tournament names, country names, team names, or league formats (e.g., "World Cup", "FIFA", "Premier League", "France", "Argentina").
- **Forbidden**: Do not define specific cup-tie rules, tournament group stages, or scheduling formulas in application logic.
- **Accepted Pattern**: All sample records and configuration keys must use generic tags:
  - `competition-alpha`, `competition-beta`
  - `season-alpha-2026`
  - `team-alpha`, `team-beta`, `team-gamma`
  - `match-alpha-001`, `match-alpha-002`

### 4. No Business Logic Implementation
- **Forbidden**: Do not write predictive inference algorithms, statistical prediction scoring formulas, or LLM-based odds analysis logic.
- **Forbidden**: Do not code active betting simulators, slip generators, bankroll calculators, risk control rule engines, or daily limits check functions.
- **Accepted Pattern**: Retain mock contract response envelopes established during Phase 2.

## Verification & Audit
Compliance is monitored through automated audit check processes:
- `pnpm run audit`: Scans for ORM imports, hard-coded competition strings, and database clients.
- `pnpm run phase2:check-rules`: Verifies that config validators reject tournament-specific config attempts.
