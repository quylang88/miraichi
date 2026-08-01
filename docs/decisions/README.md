# Architectural Decisions

## Current Product Decision

- `ADR-0044-ai-sportmonks-removal-product-reset.md` — Accepted. Defines the owner-only factual match, manual bet/odds, and bankroll product boundary.
- `ADR-0045-openfootball-source-and-manual-live-bet-boundary.md` — Accepted. Selects OpenFootball for non-live match data and keeps live-bet context owner-entered and immutable.

## Retained Foundation Decisions

- `ADR-0001-monorepo-structure.md`
- `ADR-0002-architecture-planning-approach.md`
- `ADR-0008-worker-ingestion-boundary-draft.md`
- `ADR-0009-competition-configuration-registry-boundary-draft.md`
- `ADR-0010-testing-competition-agnostic-verification-draft.md`
- `ADR-0011-agent-workflow-handoff-governance-draft.md`
- `ADR-0012-monorepo-tooling-and-package-manager.md`
- `ADR-0013-storage-responsibility-and-phase-3-persistence-boundary.md`
- `ADR-0014-data-provider-abstraction-and-source-selection-criteria.md`
- `ADR-0015-generic-football-data-contract.md`
- `ADR-0016-ingestion-quality-freshness-and-traceability-boundary.md`
- `ADR-0022-client-delivery-strategy-pwa-first-native-ios-deferred.md`
- `ADR-0023-user-entered-real-bet-record-boundary.md`
- `ADR-0024-match-centric-betting-history-grouping.md`
- `ADR-0025-market-catalog-and-line-preset-registry.md`
- `ADR-0026-odds-format-strategy-boundary.md`
- `ADR-0033-local-first-betting-data-persistence-and-backup-boundary.md`
- `ADR-0034-typescript-adoption-and-typed-domain-contracts-boundary.md`
- `ADR-0039-provider-adapter-contract-and-data-validation-schema.md`
- `ADR-0043-phase-9-cloud-database-provider.md`

Removed or superseded decisions remain recoverable from Git history. OpenFootball is the only currently approved external match source family; any additional source requires a new accepted ADR.
