# Phase 2 Review Checklist

This checklist must be run before any code changes made during Phase 2 are merged, committed, or submitted for review.

---

## 1. Architectural Guardrails (ADR Compliance)

- [ ] **App Service Boundaries (ADR-0004)**: Are new directories and entry points correctly placed within `apps/api`, `apps/web`, `apps/local-ai`, or `apps/worker`?
- [ ] **API Mediation (ADR-0005)**: Does `apps/web` call only `apps/api`? (Direct calls to `apps/local-ai` or external databases are forbidden).
- [ ] **Local AI Output (ADR-0006)**: Do the mock prediction endpoints include a traceable model trace metadata envelope?
- [ ] **LLM Refusal (ADR-0007)**: Do chatbot mock endpoints return compliant refusal messages if the input query is out-of-scope?
- [ ] **Worker Ingestion (ADR-0008)**: Is the ingestion worker structure decoupled from API servers?
- [ ] **Competition Registry (ADR-0009)**: Are all configuration files designed generically?
- [ ] **Verification Strategy (ADR-0010)**: Do scaffolded test structures run under a mock environment?
- [ ] **Agent Handoff Governance (ADR-0011)**: Are handoff messages using schema-validated interfaces?

---

## 2. Code Safety Guardrails

- [ ] **Zero Business Logic**: Confirm that no mathematical calculations, odd payout projections, or statistics rules are implemented.
- [ ] **Zero Database Hooks**: Confirm that no database clients, SQLite instances, ORM models, or migration scripts exist in the commit.
- [ ] **Zero Tournament Hardcoding**: Verify that "World Cup" is not hardcoded anywhere in components, models, or configurations.
- [ ] **Zero Production Secrets**: Ensure `.env` is ignored and that no API tokens or passwords are hardcoded in the codebase.
- [ ] **Mock-Only payloads**: Verify that the endpoints respond with payloads matching [mock-boundary-contracts.md](file:///c:/CODE/miraichi/docs/scaffolding/mock-boundary-contracts.md).

---

## 3. Monorepo & Linkage Sanity

- [ ] **Monorepo Dependency Imports**: Can `apps/` import typing or utils from `packages/` successfully?
- [ ] **Vanilla CSS Only**: Verify that `packages/ui` and component styles do not import TailwindCSS or other CSS utilities unless explicitly approved.
- [ ] **Clean Lint/Test Execution**: Does the dev runner boot the environment without compile/type errors?
