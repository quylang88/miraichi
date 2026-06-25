# Roadmap

Milestones and timeline for the development of Miraichi.

## Purpose
This document provides visibility into planned feature rollouts and releases.

## Status
- **Status**: Draft

## Scope
Outlines high-level roadmap milestones across multiple phases.

## Roadmap Guidelines
- All milestones must follow the architectural patterns laid out in ARCHITECTURE.md.
- Ensure competition-agnostic support is built into every feature.

## Milestones

### Milestone 1: Monorepo Foundation & Docs
- Complete directory bootstrapping.
- Define agent roles and protocol interfaces.
- Create initial architecture and deployment planning drafts.

### Milestone 2: Phase 1 Architecture Planning (Completed)
- Explore open architecture questions.
- Compare candidate architecture options.
- Draft system boundaries, data flow, and LLM/local AI responsibilities.
- Review competition-agnostic risks before implementation.

### Milestone 3: Skeletal Connectivity & Scaffold (Completed)
- Define app boundaries, package boundaries, mock contracts, and exit criteria.
- Establish basic API, Web, Worker, and local-ai connectivity.
- Verify communication paths via mock endpoints.

### Milestone 4: Sports Data Ingestion Planning (Completed)
- Establish provider-agnostic parser interfaces and mock feed adapters.
- Define data quality rules and generic schema validation contracts.
- Implement mock-only ingestion processing in apps/worker (database storage deferred).

### Milestone 5: Predictive Inference, Agent Handoffs & PWA Client (Completed)
- Integrate local AI mock model predictions and mediation proxies.
- Establish PWA shell caching and mobile-first responsive layout.
- Run basic agent coordination scenarios.

### Milestone 6: Betting Accounts & Bankroll Strategy Planning (Active)
- Establish specifications for simulated wagers, history, reports, and limits.
- Formulate adapter contracts for owner-controlled betting logic.
- Accept Phase 5.2 Wave A foundation ADRs and ADR-0034 as architecture/planning boundaries only.
- Start Phase 5.3 Wave A Implementation Planning without starting implementation.

### Milestone 7: Real Data Provider, Dataset, and Evaluation Planning (Future)
- Plan real data provider selection and dataset boundaries.
- Define model evaluation criteria before any real training.
- Keep provider choice, datasets, and evaluation gates under owner-approved ADRs.

### Milestone 8: Model Training and Prediction Engine R&D (Future)
- Begin real model training research only after Phase 7 planning is accepted.
- Draft prediction algorithm and model runtime ADRs before implementation.
- Keep betting recommendation and stake advice separate from prediction model R&D.

## TODO / Next Steps
- [x] Complete Phase 1 architecture planning milestones.
- [x] Align on specific target dates for Milestones 3 through 5.
- [x] Complete Phase 2 app skeleton planning and scaffolding.
- [x] Begin Phase 3 data ingestion planning.
- [x] Approve Phase 3 candidate ADRs.
- [x] Build parser stubs and mock ingestion worker flow.
- [x] Open Phase 4 planning and draft candidate ADRs.
- [x] Review Phase 4 candidate ADRs (ADR-0017 to ADR-0021).
- [x] Implement Phase 4 local-ai mock inference endpoints and client proxy.
- [x] Align client app as PWA-first and defer native iOS.
- [x] Begin Phase 5 planning for betting rules, history tracking, and risk limits.
- [x] Draft Phase 5.2 Wave A ADRs (ADR-0023, 0024, 0025, 0026, 0031, 0033).
- [x] Accept Phase 5.2 Wave A foundation ADRs and ADR-0034.
- [x] Begin Phase 5.3 Wave A Implementation Planning without starting implementation.
- [ ] Propose Phase 5.4 TypeScript tooling setup execution plan for owner review.
- [ ] Keep real AI training out of Phase 5.3 and Phase 6; reserve it for future Phase 7 and Phase 8 planning.
