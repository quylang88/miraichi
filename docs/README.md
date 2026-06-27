# Miraichi Documentation Index

Central index for cross-cutting Miraichi documentation. Do not move module-specific docs here only to make the tree look tidy; keep package and app docs near the code they explain.

## Cross-Cutting Docs
- Architecture map: `docs/architecture/module-map.md`
- ADR index: `docs/decisions/README.md`
- Testing workflow: `docs/workflows/testing-workflow.md`
- Owner gates: `docs/governance/OWNER-DECISION-GATES.md`
- Document status taxonomy: `docs/governance/DOCUMENT-STATUS-TAXONOMY.md`
- Docs status hygiene review: `docs/governance/DOCS-STATUS-HYGIENE-REVIEW.md`

## Application Docs
- API architecture: `apps/api/docs/api-architecture.md`
- Web frontend architecture: `apps/web/docs/frontend-architecture.md`
- Local AI architecture: `apps/local-ai/docs/ai-architecture.md`
- Worker architecture: `apps/worker/docs/worker-architecture.md`

## Package Docs
- UI design system: `packages/ui/docs/design-system.md`
- Config environment strategy: `packages/config/docs/environment-strategy.md`
- Shared contracts and types: `packages/shared/docs/shared-types.md`
- Agent protocol communication: `packages/agent-protocol/docs/agent-communication.md`

## Ops Docs
- Staging plan: `ops/deploy/staging-plan.md`
- CI plan: `ops/ci/github-actions-plan.md`

## Placement Rule
- Keep ADRs, architecture, workflows, governance, product, and phase reports under `docs/`.
- Keep module-specific docs under the owning app or package, such as `apps/api/docs` or `packages/ui/docs`.
- Add links here when a new module doc becomes important enough to discover from the project root.
