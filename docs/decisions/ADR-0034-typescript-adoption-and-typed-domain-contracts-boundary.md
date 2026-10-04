# ADR-0034: TypeScript Adoption and Typed Domain Contracts Boundary

* **Status**: Accepted
* **Date**: 2026-06-24
* **Accepted Date**: 2026-06-24
* **Owner Approval Required**: Yes
* **Owner Approval**: Approved
* **Implementation Status**: Not started

---

## 1. Context

The Miraichi repository currently uses a JavaScript/ESM scaffold. The root `package.json` declares `"type": "module"` and existing app/package runtime files remain JavaScript.

Miraichi is growing toward complex domain objects and replaceable boundaries, including:

* `BetRecordEnvelope`
* `MatchBettingGroup`
* `MarketCatalog`
* `LinePresetRegistry`
* `OddsFormatAdapter`
* `SettlementStrategy`
* `ReportAggregator`
* `AiRecommendationBoundary`
* `RiskRuleStrategy`

These objects are expected to move across `apps/web`, `apps/api`, `apps/worker`, and `packages/shared`. Keeping them as loose JavaScript objects for too long increases the risk of field drift, mismatched optional fields, incompatible envelope versions, and inconsistent assumptions between app boundaries.

TypeScript can reduce contract mismatch by making shared domain shapes explicit at compile time. It is a technical architecture direction only. It does not approve betting logic, prediction algorithms, storage engines, frameworks, providers, or formulas.

---

## 2. Decision

Draft decision only:

* Adopt TypeScript as the preferred technical direction for new domain contracts and future implementation work.
* Use gradual adoption.
* Existing JavaScript files do not need to migrate immediately.
* Future new shared domain contracts should be TypeScript-first after this ADR is accepted.
* Existing JavaScript runtime scripts can remain JavaScript until a specific migration plan is approved.
* TypeScript adoption does not select any frontend framework.
* TypeScript adoption does not select any backend framework.
* TypeScript adoption does not select any database, ORM, model runtime, AI provider, deployment target, or hosting strategy.

This ADR does not authorize implementation. It does not add dependencies, compiler configuration, build scripts, or source migrations.

---

## 3. Owner-Approved Technical Direction

The owner agrees with the following technical direction:

* Miraichi should adopt TypeScript.
* TypeScript should be adopted as a technical architecture direction.
* TypeScript is preferred for safer future development.
* Existing JavaScript should not be migrated all at once.
* New domain contracts and future implementation work should move TypeScript-first after approval.
* Technical architecture recommendations may be proposed by the AI agent.
* Business logic decisions remain owner-decided and must continue to follow `docs/governance/OWNER-DECISION-GATES.md`.

---

## 4. AI Technical Recommendations

The AI technical recommendation is to adopt TypeScript gradually:

* Start with typed shared contracts in `packages/shared`.
* Add TypeScript tooling in a later implementation plan, not in this ADR.
* Prefer strict typing for domain contracts once tooling is approved.
* Use `allowJs` or an equivalent migration strategy later if needed.
* Keep generated/build outputs out of source control unless explicitly needed.
* Keep TypeScript configuration centralized or consistently layered across apps and packages.
* Keep runtime validation separate from TypeScript types. Compile-time types do not replace input validation, API payload validation, backup import validation, or persistence validation.

Recommended migration sequence:

1. **Phase A: TypeScript tooling plan** - Decide exact package dependencies, TypeScript version, config layering, typecheck command, and migration guardrails.
2. **Phase B: Shared domain contracts** - Add TypeScript-first contracts for stable shared domain boundaries after owner approval.
3. **Phase C: New config/registry modules** - Move new registry-style modules to typed contracts where doing so reduces drift.
4. **Phase D: App-by-app migration** - Migrate existing app code only when a specific package or app has a justified migration plan.

---

## 5. What TypeScript Must Not Decide

TypeScript adoption must not decide or imply:

* Prediction algorithm.
* Betting formula.
* Profit/loss formula.
* Settlement formula.
* Odds conversion formula.
* ROI, yield, or CLV formula.
* Stake-sizing or Kelly Criterion.
* Bankroll rule.
* Risk rule.
* AI recommendation logic.
* Database schema.
* Frontend framework choice.
* Backend framework choice.
* Database provider choice.
* ORM choice.
* AI provider choice.
* Sports data provider choice.
* Deployment target.

---

## 6. Alternatives Considered

### Option A: Stay JavaScript-Only

Keep all contracts as JavaScript objects and Markdown documentation.

* **Benefit**: Lowest immediate tooling cost and no migration overhead.
* **Cost**: Higher risk of field drift, envelope mismatch, and accidental contract divergence across apps.

### Option B: TypeScript-First for New Contracts With Gradual Migration

Adopt TypeScript for new shared domain contracts and future implementation work, while leaving existing JavaScript in place until migration is justified.

* **Benefit**: Adds type safety where contracts are most fragile without derailing Phase 5.
* **Cost**: Requires later tooling decisions and careful migration discipline.
* **Recommendation**: Recommended.

### Option C: Full Repo TypeScript Migration Immediately

Migrate existing JavaScript files and all apps/packages to TypeScript now.

* **Benefit**: Fastest path to a fully typed repository.
* **Cost**: Too disruptive for the current phase. It risks changing runtime behavior, build assumptions, scripts, and package boundaries before the implementation plan is approved.

---

## 7. Future Extension Points

After this ADR is accepted and a later implementation plan approves tooling, TypeScript may be used to define:

* Typed `BetRecordEnvelope`.
* Typed `MatchBettingGroup`.
* Typed `MarketCatalog`.
* Typed `OddsFormat`.
* Typed `ReportEnvelope`.
* Typed `RecommendationCard`.
* Typed persistence adapter.
* Typed navigation configuration after toolchain approval.

These extension points remain contract and architecture boundaries. They do not authorize formulas, algorithms, provider integrations, database schemas, or UI implementation.

---

## 8. Deferred Implementation Decisions

The following decisions are deferred:

* Exact TypeScript version.
* `tsconfig` structure.
* Whether to use `tsc`, `tsx`, `tsup`, `vite`, or another tool.
* Whether apps are compiled or run directly.
* Package export strategy.
* CI typecheck command.
* Migration schedule.
* Whether existing JavaScript apps use `allowJs`, incremental conversion, or isolated typed packages.

---

## 9. Explicit Implementation Exclusions

This ADR does not implement TypeScript. It explicitly excludes:

* No `package.json` dependency changes.
* No TypeScript installation.
* No `tsconfig` files.
* No JavaScript-to-TypeScript migration.
* No `.js` to `.ts` renames.
* No build pipeline.
* No executable code.
* No framework selection.
* No database client.
* No ORM.
* No schema or migration files.
* No secrets or API keys.
* No betting calculations.
* No prediction algorithms.
* No AI recommendation algorithms.
* No provider integrations.

---

## 10. Open Questions for Owner/Technical Review

* Should TypeScript first apply only to `packages/shared`, or to all new packages?
* Should strict mode be mandatory from day one for domain contracts?
* Should existing JavaScript apps remain JavaScript until Phase 5 code planning?
* Should ADR-0034 be accepted before Wave A ADR acceptance, or alongside Wave A?

## Acceptance Notes

This ADR is accepted as an architecture and planning boundary.

This ADR accepts TypeScript as the technical direction for future typed domain contracts and gradual adoption. It does not authorize implementation by itself, and it does not authorize TypeScript dependency installation, `tsconfig` creation, JavaScript-to-TypeScript migration, build pipeline changes, framework selection, storage implementation, integrations, prediction algorithms, betting formulas, or AI recommendation behavior.

Implementation requires a later owner-approved implementation plan. Business logic, formulas, algorithms, storage implementation, and integrations remain blocked unless explicitly approved by later ADRs or implementation plans.
