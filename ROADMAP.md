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

### Milestone 2: Phase 1 Architecture Planning (Completed - Acceptance Pending)
- Explore open architecture questions.
- Compare candidate architecture options.
- Draft system boundaries, data flow, and LLM/local AI responsibilities.
- Review competition-agnostic risks before implementation.

### Milestone 3: Skeletal Connectivity
- Establish basic API, Web, Worker, and local-ai connectivity.
- Verify communication paths via mock endpoints.

### Milestone 4: Real Sports Data Ingestion
- Implement basic generic sports feed adapters.
- Save ingestion results in database (to be modeled).

### Milestone 5: Predictive Inference & Agent Handoffs
- Integrate local AI model predictions.
- Run basic agent coordination scenarios.

## TODO / Next Steps
- [x] Complete Phase 1 architecture planning milestones.
- [ ] Align on specific target dates for Milestones 3 through 5.
