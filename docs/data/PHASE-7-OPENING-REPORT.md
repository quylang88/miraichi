# Phase 7 Opening Report: Real Data Provider, Dataset, and Evaluation Planning

* **Date**: June 28, 2026
* **Phase Name**: Phase 7 - Real Data Provider, Dataset, and Evaluation Planning
* **Status**: Partial ADR Acceptance - Remaining Owner Review Required

---

## 1. Executive Summary

Phase 7 is officially open. This milestone establishes the planning framework for real data provider selection, dataset construction boundaries, evaluation criteria, and model-readiness gates before any model training or live API integrations are implemented.

As of the latest owner review, ADR-0036, ADR-0037, ADR-0038, and ADR-0039 have been accepted as planning boundaries only. ADR-0035 provider strategy and ADR-0040 model-readiness gates remain draft and require another owner review round.

---

## 2. Draft Planning Deliverables

- **Phase 7 Planning Documents**:
  - [phase-7-planning.md](file:///c:/CODE/miraichi/docs/data/phase-7-planning.md) (Status: Partial ADR Acceptance - Remaining Provider/Gate Review Required)
  - [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md) (Status: Candidate)
  - [ADR-DRAFT-REVIEW-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-DRAFT-REVIEW-PHASE-7.md) (Status: Draft Review - Owner Review Required)
  - [ADR-ACCEPTANCE-SUMMARY-PHASE-7-PARTIAL.md](file:///c:/CODE/miraichi/docs/decisions/ADR-ACCEPTANCE-SUMMARY-PHASE-7-PARTIAL.md) (Status: Partial Acceptance - Remaining Owner Review Required)

- **Standalone ADR Files**:
  - [ADR-0035-real-data-provider-selection-and-integration-strategy-draft.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0035-real-data-provider-selection-and-integration-strategy-draft.md) (Status: Draft - Owner Review Required)
  - [ADR-0036-world-cup-fixture-coverage-competition-agnostic-adapter.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0036-world-cup-fixture-coverage-competition-agnostic-adapter.md) (Status: Accepted)
  - [ADR-0037-dataset-boundaries-and-schema-for-prediction.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0037-dataset-boundaries-and-schema-for-prediction.md) (Status: Accepted)
  - [ADR-0038-prediction-evaluation-criteria-and-metrics.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0038-prediction-evaluation-criteria-and-metrics.md) (Status: Accepted)
  - [ADR-0039-provider-adapter-contract-and-data-validation-schema.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0039-provider-adapter-contract-and-data-validation-schema.md) (Status: Accepted)
  - [ADR-0040-model-readiness-gates-and-deployment-governance-draft.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0040-model-readiness-gates-and-deployment-governance-draft.md) (Status: Draft - Owner Review Required)


---

## 3. Strict Guardrail Confirmations

- **No Active Ingestion Code**: **CONFIRMED**. No HTTP clients, data parsers, scraper scripts, or mock-to-live poller workflows have been introduced or modified in this step.
- **No Database/Secrets**: **CONFIRMED**. No active database connections, ORM code, migration files, schema changes, or API keys/credentials have been added to the project.
- **No Tournament Hard-Coding**: **CONFIRMED**. While full FIFA World Cup fixture coverage is the first target, the architecture remains competition-agnostic and adapter-based. All schemas and contracts use generic parameters, avoiding hardcoded tournament definitions.

---

## 4. Current Blockers & Open Decisions

There are no blocking bugs in the docs-only opening package. However, active live-provider implementation and Phase 8 model R&D remain blocked until the following draft ADRs are reviewed and accepted by the project owner:
- **ADR-0035**: Real Data Provider Selection and Integration Strategy. Current recommendation is API-Football as the primary owner-only free-tier pilot candidate if the owner confirms current pricing, quota, endpoint coverage, and terms.
- **ADR-0040**: Model-Readiness Gates and Deployment Governance. Current recommendation is to keep gates as owner-only R&D report gates until Phase 8 empirical evidence exists.

---

## 5. Next Recommended Step

- **Step**: Review ADR-0035 and ADR-0040 again, resolve owner questions, and record accepted decisions only if the remaining provider and model gate risks are settled.
- **Next Planning Milestone**: Convert accepted provider and governance decisions into a `phase:implementation-plan` only after owner approval. Phase 8 model training R&D remains blocked until then.
