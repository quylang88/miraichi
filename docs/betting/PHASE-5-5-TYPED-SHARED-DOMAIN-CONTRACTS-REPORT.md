# Phase 5.5 Typed Shared Domain Contracts Report

**Date**: 2026-06-25

This report documents the limited Phase 5.5 implementation for shared TypeScript domain contracts.

---

## 1. Scope

Phase 5.5 was approved for shared TypeScript domain contract files only.

Included:

* Add type-only shared contracts for accepted Wave A betting boundaries.
* Typecheck the new TypeScript contract files.
* Keep existing JavaScript apps unchanged.
* Keep runtime validation, storage, formulas, algorithms, UI, and routers out of scope.

Excluded:

* No JS-to-TS app migration.
* No `.js` to `.ts` file renames.
* No frontend or backend framework selection.
* No UI/router implementation.
* No IndexedDB, export/import, database, ORM, schema, or migration implementation.
* No bookmaker/payment integration.
* No secrets/API keys.
* No runtime validators.
* No betting calculations, profit/loss formulas, odds conversion formulas, settlement formulas, ROI/yield/CLV formulas, or stake-sizing/Kelly/bankroll/risk formulas.
* No AI recommendation algorithms or prediction algorithms.
* No hard-coded real teams, real leagues, World Cup, FIFA, or real tournaments.

---

## 2. Files Changed

* `packages/shared/src/contracts/betting-domain-contracts.ts`
  - Added type-only shared contracts for Phase 5.5.
* `packages/shared/src/contracts/betting-domain-contracts.typecheck.ts`
  - Added compile-only type assertions for the accepted boundaries.
* `tsconfig.base.json`
  - Added `packages/**/*.ts` to `include` so shared TypeScript contract files are covered by root typecheck.
* `docs/betting/PHASE-5-5-TYPED-SHARED-DOMAIN-CONTRACTS-REPORT.md`
  - Added this report.
* `docs/betting/PHASE-5-5-TYPED-SHARED-DOMAIN-CONTRACTS-REVIEW.md`
  - Added verification review.
* `PROJECT_PLAN.md`
  - Updated Phase 5 progress and next step.
* `ROADMAP.md`
  - Updated Milestone 6 progress and next step.

---

## 3. Technical Structure Chosen

Chosen structure:

* One contract module: `packages/shared/src/contracts/betting-domain-contracts.ts`
* One compile-only typecheck module: `packages/shared/src/contracts/betting-domain-contracts.typecheck.ts`
* Root `tsconfig.base.json` includes `packages/**/*.ts`
* No package barrel export change in this phase.
* No runtime JavaScript wrapper.
* No generated output.

The contract module contains only `export type` and `export interface` declarations. It defines no functions, constants, classes, validators, adapters, storage access, formulas, or executable business logic.

The typecheck module uses `import type` and type-level assertions only. It is included by `tsconfig.base.json`, so `pnpm run typecheck` fails if these contracts drift away from the accepted Wave A boundaries.

---

## 4. Alternatives Considered

### Option A: Add contracts directly to existing JavaScript contract files

Rejected.

Reason: Existing shared contract files are JavaScript runtime modules. Adding TypeScript-like JSDoc contracts there would keep the boundary weaker and would not satisfy the accepted TypeScript-first direction for new shared domain contracts.

### Option B: Add a full `packages/shared/src/contracts/index.ts` barrel

Rejected for Phase 5.5.

Reason: A TypeScript barrel could be useful later, but it changes the package export surface before any app consumes these contracts. Existing consumers are JavaScript and current shared package entry points are JavaScript. Forcing a barrel change now is unnecessary and creates avoidable runtime-resolution risk.

### Option C: Add package-level `tsconfig` files

Rejected for Phase 5.5.

Reason: The root TypeScript config from Phase 5.4 is enough for two shared contract files. A package-level config would add structure without solving a current problem.

### Option D: Add runtime validators with the contracts

Rejected.

Reason: Runtime validation is explicitly blocked in Phase 5.5. TypeScript contracts are compile-time boundaries only and do not replace later owner-approved validation work.

---

## 5. Why This Structure Is Safest For The Current Repo

This structure is the safest option because it adds the minimum TypeScript surface needed for Phase 5.5 without touching current app runtime behavior.

Concrete reasons:

* It keeps existing JavaScript apps unchanged.
* It avoids package export churn before there is a real consumer.
* It keeps all new TypeScript inside `packages/shared/src/contracts`.
* It lets root `pnpm run typecheck` verify the new files immediately.
* It separates compile-time contracts from future runtime validators.
* It avoids storage, UI, formulas, and algorithm implementation.

The blunt trade-off: these types are not yet consumed by apps. That is intentional. Phase 5.5 is a contract boundary phase, not an app implementation phase.

---

## 6. tsconfig Update Summary

`tsconfig.base.json` now includes:

* `packages/**/*.ts`

This is required because Phase 5.4 originally included JavaScript files only. Without this include, the new TypeScript contract files would exist but would not be covered by `pnpm run typecheck`.

No package-level `tsconfig` was added.

---

## 7. Contracts Added

### BetRecordEnvelope

Added `BetRecordEnvelope` based on ADR-0023.

Core covered fields include:

* `betId`
* `matchGroupId`
* `createdAt`
* `betTimeType`
* `homeTeamName`
* `awayTeamName`
* `marketType`
* `selectionLabel`
* `oddsFormat`
* `oddsValue`
* `stakePoints`
* `status`

Optional covered fields include:

* `matchId`
* `competitionLabel`
* `seasonLabel`
* `marketSubtype`
* `lineValue`
* `lineDisplay`
* `liveScoreHome`
* `liveScoreAway`
* `liveMinute`
* `settlement`
* `profitLossPoints`
* `notes`
* `tags`
* `source`
* `trace`
* `predictionTraceId`
* `recommendationId`

Important boundary notes:

* `profitLossPoints` is nullable/signed shape only. No formula was added.
* `source` is limited to `manual` and `ai_recommendation`; `imported` remains an unanswered owner question from ADR-0023 and was not silently added.
* `trace`, `predictionTraceId`, and `recommendationId` are reference fields only. They do not implement AI recommendation behavior.

### MatchBettingGroup

Added `MatchBettingGroup` based on ADR-0024.

Covered fields:

* `matchGroupId`
* `homeTeamName`
* `awayTeamName`
* `bets`
* `matchId`
* `kickoffTime`
* `competitionLabel`
* `seasonLabel`
* `groupStatus`

Important boundary notes:

* `matchGroupId` remains the source of truth for grouping.
* No auto-grouping, auto-merge, feed matching, or normalization algorithm was added.

### MarketCatalog and LinePresetRegistry

Added market and line preset shapes based on ADR-0025.

Covered types:

* `MarketType`
* `MarketDefinition`
* `MarketCatalog`
* `LinePresetDefinition`
* `LinePresetRegistry`
* `LineValue`
* `NonStandardLinePolicy`

Important boundary notes:

* V1 `MarketType` includes `1X2`, `over_under`, `handicap`, `corners`, and `custom`.
* `manualLineEntryAllowed` exists on market definitions.
* `LinePresetRegistry.manualLineEntryAllowed` is typed as `true` to preserve the owner-approved manual override boundary.
* Non-standard line behavior is represented as `warning_only` metadata only. No hard-block validator was added.
* No market catalog config file was added in this phase.

### HK-Only Odds Shape

Added HK-only odds types based on ADR-0026.

Covered types:

* `OddsFormat`
* `OddsValueFields`

Important boundary notes:

* `OddsFormat` is only `HK`.
* `oddsValue` stores the raw user-entered numeric value shape.
* `normalizedOddsValue` is optional nullable future shape only.
* No odds conversion formula, rounding logic, or odds adapter implementation was added.

---

## 8. Confirmation Existing JS Apps Remain Unchanged

Existing JavaScript apps remain unchanged:

* `apps/web`
* `apps/api`
* `apps/local-ai`
* `apps/worker`

No existing JavaScript source file was renamed to TypeScript.

No UI/router, storage, database, formula, AI recommendation, prediction, bookmaker, payment, or secret-bearing app code was added.

---

## 9. Commands Run and Results

| Command | Result | Notes |
| :--- | :--- | :--- |
| `pnpm run typecheck` | PASS | `tsc -p tsconfig.base.json --noEmit` completed successfully and covered `packages/**/*.ts`. |
| `pnpm run check` | PASS | Skeleton file verification passed. |
| `pnpm run audit` | PASS | Zero guardrail violations found. |
| `pnpm run phase2:verify` | PASS | Scope enforcement and endpoint boundary tests passed. Node emitted existing `url.parse()` deprecation warnings during endpoint tests. |
| `pnpm run phase3:verify` | PASS | Phase 3 ingestion verification passed. |
| `pnpm run phase4:verify` | PASS | Phase 4 mock local AI verification passed. |
| `pnpm run phase4:integration` | PASS | Phase 4 integration verification passed. Node emitted existing `url.parse()` deprecation warnings. |
| `pnpm run pwa:verify` | PASS | PWA compliance verification passed. |

---

## 10. What Remains Blocked

The following remain blocked:

* Runtime validators.
* App consumption of the new contracts.
* JS-to-TS app migration.
* UI/router implementation.
* Calendar-first UI implementation.
* Native wrapper implementation.
* IndexedDB implementation.
* Export/import implementation.
* Database clients, ORMs, schemas, and migrations.
* Bookmaker/payment integrations.
* Secrets/API keys.
* Betting calculations.
* Profit/loss formulas.
* Odds conversion formulas.
* ROI/yield/CLV formulas.
* Settlement formulas.
* Stake-sizing/Kelly/bankroll/risk formulas.
* AI recommendation algorithms.
* Prediction algorithms.
* Real teams, real leagues, World Cup, FIFA, or real tournament hardcoding.

---

## 11. Next Recommended Phase

Proceed to **Phase 5.6 Market Catalog and Line Preset Config** as a proposed next phase.

Phase 5.6 should stay narrow:

* Add static, typechecked market catalog and line preset configuration only if owner approves.
* Keep warning-only line metadata.
* Keep manual line entry allowed.
* Do not add validators, formulas, settlement logic, storage, UI/router, AI recommendation algorithms, or prediction algorithms.

Real AI training remains deferred to future Phase 7 and Phase 8 planning.
