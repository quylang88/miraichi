# Architectural Decisions

## Current Product Decision

- `ADR-0044-ai-sportmonks-removal-product-reset.md` — Accepted. Defines the owner-only factual match, manual bet/odds, and bankroll product boundary.
- `ADR-0046-core-bet-bankroll-discipline-and-reporting.md` — Accepted. Defines manual settlement, bankroll accounting, discipline warnings, psychology journaling, reports, and EN/VI UI boundaries.
- `ADR-0050-single-bankroll-usable-owner-flow.md` — Accepted. Keeps one visible bankroll, preserves an internal compatibility account, and closes the reviewed bet/bankroll/psychology integrity and usability gaps.
- `ADR-0052-supabase-edge-cloudflare-owner-hosting.md` — Accepted. Replaces the blocked Koyeb path with Cloudflare Worker Static Assets, one gateway-protected Supabase Edge Function, direct private Postgres access, Vault-backed cron, and Frankfurt-to-Tokyo rollout gates.
- `ADR-0051-owner-hosted-api-and-live-overlay.md` — Hosting/scheduling superseded by ADR-0052. Its owner authentication, visibility-driven SportScore widget live refresh, and provider-neutral terminal/current boundaries remain accepted.
- `ADR-0048-sportscore-public-api-source-boundary.md` — Accepted. Selects the attributed SportScore public API for 50 equal competitions, terminal-only best-effort 15–30 minute result updates, and lazy basic match detail.

## Superseded Source Decisions

- `ADR-0045-openfootball-source-and-manual-live-bet-boundary.md` — External-source portion superseded; the manual owner-entered context boundary remains historical context.
- `ADR-0047-api-football-rapid-match-ingestion.md` — Superseded after the Free plan failed current-season entitlement validation.

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

- `ADR-0053-user-triggered-hosted-match-detail.md` — Accepted within the 2026-09-09 owner request.
  Reopens rich factual detail through explicit per-match actions, private durable cache and hosted E2E.

Removed or superseded decisions remain in Git for audit. Current approved providers are FotMob
(ADR-0049/0053), OpenFootball's configured season files, and SportScore's attributed widget API.
New providers require an accepted decision; ESPN and API-Football remain inactive.
