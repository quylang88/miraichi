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

### Milestone 4: Sports Data Ingestion Planning (In Progress)
- Establish provider-agnostic parser interfaces and mock feed adapters.
- Define data quality rules and generic schema validation contracts.
- Implement mock-only ingestion processing in apps/worker (database storage deferred).

### Milestone 5: Predictive Inference & Agent Handoffs
- Integrate local AI model predictions.
- Run basic agent coordination scenarios.

## TODO / Next Steps
- [x] Complete Phase 1 architecture planning milestones.
- [x] Align on specific target dates for Milestones 3 through 5.
- [x] Complete Phase 2 app skeleton planning and scaffolding.
- [x] Begin Phase 3 data ingestion planning.
- [ ] Approve Phase 3 candidate ADRs and build parser stubs.
