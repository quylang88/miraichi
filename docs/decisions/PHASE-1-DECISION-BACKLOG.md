# Phase 1 Decision Backlog

## Purpose
Track and manage unresolved, deferred, or pending architectural decisions for the Miraichi project.

## Status
- **Status**: Active Backlog
- **Date**: 2026-06-23

## Scope
Catalog all unresolved Phase 1 ADR candidates, deferred operational details, and split decisions that must be resolved before implementation phases lock.

---

## 1. Decision Backlog Table

| Decision Topic | Current Status | Reason Deferred | Recommended Revisit Phase | Blocking Phase | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADR-0003 Product Boundary** | Proposed | Pending owner confirmation of first milestone product scope. | Phase 2 (Early Planning) | Phase 2 (Skeleton) | Sets boundaries for web/API stubs. Recommended as the first task of Phase 2. |
| **Storage Responsibility & Persistence** | Deferred | Awaiting data schema audit and prediction history storage rules. | Phase 2 (Planning) | Phase 3 (Data Ingestion) | Defines database choice, ORM selection, and folder organization. |
| **Deployment & Environment Strategy** | Deferred | Awaiting model hosting choices and third-party sports API credential rules. | Phase 2 (Planning) | Phase 6 (Testing/Deploy) | Configures local sandbox versus staging environments. |
| **Bet History & Audit Boundary** | Deferred | Split from Candidate 009; requires database modeling details. | Phase 2 (Planning) | Phase 5 (Betting Module) | Governs auditability of predictions and accuracy tracking. |
| **Bankroll, Risk, & Responsible Use** | Deferred | Split from Candidate 009; needs user-limit and risk rules defined. | Phase 2 (Planning) | Phase 5 (Betting Module) | Core validation boundaries preventing unrestricted betting logic. |
| **Security, Secrets, & Privacy** | Deferred | Split from Candidate 011; requires secret vault and key isolation plans. | Phase 2 (Planning) | Phase 6 (Testing/Deploy) | Isolating tokens and keys away from repository source code. |
| **Chat Persistence & Privacy** | Deferred | Deployed details around sensitive conversation caching are undecided. | Phase 2 (Planning) | Phase 5 (Betting Module) | Determines storage mechanisms and retention rules for LLM chats. |
| **Local AI Invocation Timing** | Deferred | Decisions around scheduling, batch, or hybrid execution remain open. | Phase 2 (Planning) | Phase 4 (Local AI) | Invocation trigger models for local inference pipeline. |
| **Model Runtime & Algorithms** | Deferred | Choice of model libraries and training pipelines is out of scope for Phase 1. | Phase 4 (Local AI) | Phase 4 (Local AI) | Selecting model formats (ONNX, PyTorch) and prediction features. |

---

## 2. Backlog Rules
* **Strict ADR Governance**: No pending decision from this backlog may silently become implementation code. Every item must first be drafted as an ADR candidate, reviewed, and promoted to **Accepted** status via project owner approval before implementation begins.
* **Competition Agnosticism**: All backlog resolutions must retain strict competition agnosticism.

---

## 3. Recommended Next Milestone
* **Next Phase**: **Phase 2 - App Skeleton and Scaffold Planning**
* > [!IMPORTANT]
  > **Phase 2 Planning Gateway**: Phase 2 should start with the review and promotion of [ADR-0003](file:///c:/CODE/miraichi/docs/decisions/ADR-0003-product-boundary-first-planning-target-draft.md) because the final product scope boundary directly affects workspace skeleton and API gateway scaffolding.
