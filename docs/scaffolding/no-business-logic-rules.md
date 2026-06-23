# No Business Logic Rules

This document outlines the strict architectural rules governing Phase 2 scaffolding. Under no circumstances may business calculations, persistent schemas, or specific domain couplings be implemented.

---

## 1. Absolute Rule: No Business Calculations

Scaffold code must not calculate or process actual business outcomes. The following categories are strictly forbidden:
* **No Betting Payouts/Returns**: Do not write code to calculate potential winnings based on odds, stake size, or odds formats (decimal, fractional).
* **No Implied Probability Math**: Do not write calculators converting odds to probabilities or vice-versa (e.g. \(P = \frac{1}{\text{odds}}\)).
* **No Bankroll Allocation Algorithms**: Do not write Kelly Criterion or proportional stake size selectors.
* **No Actual Prediction Analysis**: The statistical model and LLM explanation services must return pre-compiled mock payloads. Do not build rule engines that evaluate team scoring statistics or run-differentials.

---

## 2. Absolute Rule: No Database Persistence

Scaffold code must remain stateless and database-free.
* **No Database Engines**: Do not pull in SQLite, Postgres, Redis, or Mongo libraries as active database stores.
* **No ORM Modeling**: Do not define Prisma, Sequelize, TypeORM, or Mongoose models.
* **No Schema Migrations**: Do not create SQL files, DDL statements, or DB migration directories.
* **Transient Memory Only**: If temporary state is required (e.g., logging a mock bet history item), it must live inside an ephemeral in-memory array variable that resets when the process restarts.

---

## 3. Absolute Rule: Competition Agnosticism

Miraichi is built as a generic football statistics and prediction assistant. It must not be hardcoded to any specific event or tournament.
* **No Tournament Coupling**: The code, schemas, and configurations must not mention the "World Cup" (or any specific leagues like "Premier League" or "La Liga") as a hardcoded static route, component label, or configuration structure.
* **Dynamic Registries**: All match configurations must use generic fields:
  - `competitionId`
  - `seasonId`
  - `matchId`
  - `teamId`
* **World Cup as a Profile**: The World Cup is merely one configuration profile that can be loaded. The application skeleton must work equally well with any generic configuration registry (ADR-0009).

---

## 4. Absolute Rule: No Secrets or External APIs

* **No Production Credentials**: Do not add API keys, client secrets, passwords, or encryption keys to config files or `.env` files.
* **No Live Downstream APIs**: Do not construct Axios or Fetch calls to real sports data feed providers. All source feeds parsed by the worker must be local JSON file mocks.
