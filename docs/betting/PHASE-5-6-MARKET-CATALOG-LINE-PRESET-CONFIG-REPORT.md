# Phase 5.6 Market Catalog and Line Preset Config Report

**Date**: 2026-06-25

This report documents the limited Phase 5.6 implementation for static, typechecked market catalog and line preset configuration.

---

## 1. Scope

Phase 5.6 was approved for static market catalog and line preset configuration only.

Included:

* Add static v1 market catalog config for the accepted owner baseline.
* Add static line preset config for markets where line presets make technical sense.
* Use Phase 5.5 shared TypeScript contracts.
* Add compile-only guards so `pnpm run typecheck` covers the config.
* Keep config generic and competition-agnostic.

Excluded:

* No runtime validators.
* No hard-block validation logic.
* No settlement formulas.
* No profit/loss formulas.
* No odds conversion formulas.
* No ROI/yield/CLV formulas.
* No stake-sizing/Kelly/bankroll/risk formulas.
* No betting calculations.
* No AI recommendation algorithms.
* No prediction algorithms.
* No UI/router files.
* No IndexedDB, export/import, database, ORM, schema, or migration implementation.
* No bookmaker/payment integration.
* No secrets/API keys.
* No app migration to TypeScript.
* No `.js` to `.ts` renames.
* No frontend/backend frameworks.
* No real teams, real leagues, World Cup, FIFA, or real tournaments.

---

## 2. Files Changed

* `packages/shared/src/config/betting-market-catalog.ts`
  - Added static v1 market catalog and line preset registries.
* `packages/shared/src/config/betting-market-catalog.typecheck.ts`
  - Added compile-only guard assertions for market coverage, manual line entry, warning-only metadata, and custom market behavior.
* `packages/shared/src/contracts/betting-domain-contracts.ts`
  - Added `manualEscapeHatch?: true` to `MarketDefinition`.
* `docs/betting/PHASE-5-6-MARKET-CATALOG-LINE-PRESET-CONFIG-REPORT.md`
  - Added this report.
* `docs/betting/PHASE-5-6-MARKET-CATALOG-LINE-PRESET-CONFIG-REVIEW.md`
  - Added verification review.
* `PROJECT_PLAN.md`
  - Updated Phase 5 progress and next step.
* `ROADMAP.md`
  - Updated Milestone 6 progress and next step.

No existing JavaScript file was renamed or migrated.

---

## 3. Technical Structure Chosen

Chosen structure:

* Static config module: `packages/shared/src/config/betting-market-catalog.ts`
* Compile-only guard module: `packages/shared/src/config/betting-market-catalog.typecheck.ts`
* Existing shared contracts remain in `packages/shared/src/contracts/betting-domain-contracts.ts`
* Root `tsconfig.base.json` already covers `packages/**/*.ts`, so no tsconfig change was needed.
* No package barrel export change was made.

The config file exports static typed constants:

* `v1OverUnderLinePresetRegistry`
* `v1HandicapLinePresetRegistry`
* `v1CornersLinePresetRegistry`
* `v1LinePresetRegistries`
* `v1MarketCatalog`

The config uses `satisfies` against Phase 5.5 contracts. That gives compile-time coverage while keeping the values static and readable.

---

## 4. Alternatives Considered

### Option A: Add JSON config

Rejected for Phase 5.6.

Reason: JSON is static, but it would need separate type assertion glue or schema validation to prove it matches the Phase 5.5 contracts. Runtime validation is blocked, and adding extra glue would be more moving parts than the current repo needs.

### Option B: Add TypeScript config under `packages/shared/src/config`

Accepted.

Reason: It is the smallest structure that can use the Phase 5.5 contracts directly, is covered by root typecheck, and avoids app runtime changes.

### Option C: Export config through the existing JavaScript barrel

Rejected for Phase 5.6.

Reason: Existing consumers remain JavaScript, and no app consumes this config yet. Changing the package export surface now would be unnecessary runtime boundary churn.

### Option D: Add lookup helper functions

Rejected.

Reason: Lookup helpers are executable runtime code. Phase 5.6 is config only, not registry behavior, validation, or UI logic.

### Option E: Add validator helpers for line increments

Rejected.

Reason: Validation helpers, especially hard-block helpers, are explicitly blocked. Phase 5.6 stores warning-only metadata but does not enforce it.

---

## 5. Why This Structure Is Safest For The Current Repo

This structure is safest because it gives the repo typechecked config without changing runtime behavior.

Concrete reasons:

* The config is isolated under `packages/shared/src/config`.
* The config uses existing Phase 5.5 contracts instead of inventing a parallel shape.
* TypeScript catches market coverage drift through `betting-market-catalog.typecheck.ts`.
* Existing JavaScript apps and package barrels are untouched.
* There are no helper functions, validators, calculators, storage adapters, or UI hooks.
* Presets are data only; manual line entry remains allowed for every market entry.

The trade-off is deliberate: no app can consume this config through the existing JavaScript package entry yet. That is acceptable because Phase 5.6 is a shared config boundary phase, not an app integration phase.

---

## 6. Config Entries Added

### Market Catalog

Added `v1MarketCatalog` with these market entries:

* `1X2`
* `over_under`
* `handicap`
* `corners`
* `custom`

Each market entry includes `manualLineEntryAllowed: true`.

Line-based markets include `nonStandardLinePolicy: 'warning_only'`:

* `over_under`
* `handicap`
* `corners`

Custom Market includes `manualEscapeHatch: true` and no line preset registry.

### Line Preset Registries

Added static line preset registries for:

* `over_under`
* `handicap`
* `corners`

No line preset registry was added for:

* `1X2`
* `custom`

Preset values are static seed config only. They are not settlement logic, payout logic, validation logic, or owner-final business formulas. Manual entry remains allowed, so users are not locked into the seed presets.

---

## 7. Type Adjustments

Added this optional field to `MarketDefinition`:

* `manualEscapeHatch?: true`

Reason:

The Phase 5.6 request requires Custom Market to remain a manual escape hatch. Encoding that as typed metadata is safer than relying on comments or implicit display names. The field is optional and does not alter existing Phase 5.5 boundaries for other markets.

No formula, validator, settlement, payout, persistence, or UI behavior was added with this type adjustment.

---

## 8. Confirmation Config Is Static And Generic

The config is static:

* No `function` declarations.
* No `class` declarations.
* No lookup helpers.
* No runtime validation.
* No storage reads/writes.
* No formulas or calculations.

The config is generic:

* No real teams.
* No real leagues.
* No World Cup.
* No FIFA.
* No real tournaments.
* No event-specific records.

---

## 9. Confirmation Existing JS Apps Remain Unchanged

Existing JavaScript apps remain unchanged:

* `apps/web`
* `apps/api`
* `apps/local-ai`
* `apps/worker`

No app file was migrated to TypeScript.

No existing `.js` file was renamed.

No UI/router, storage, database, formula, AI recommendation, prediction, bookmaker, payment, or secret-bearing app code was added.

---

## 10. Commands Run And Results

| Command | Result | Notes |
| :--- | :--- | :--- |
| `pnpm run typecheck` before Phase 5.6 guard | PASS | Baseline typecheck passed before new config work. |
| `pnpm run typecheck` after adding guard before config | FAIL | Expected RED: missing `./betting-market-catalog.js`. |
| `pnpm run typecheck` after adding config | PASS | Config and guards typechecked successfully. |
| `pnpm run check` | PASS | Skeleton file verification passed. |
| `pnpm run audit` | PASS | Zero guardrail violations found. |
| `pnpm run phase2:verify` | PASS | Scope enforcement and endpoint boundary tests passed. Node emitted existing `url.parse()` deprecation warnings during endpoint tests. |
| `pnpm run phase3:verify` | PASS | Phase 3 ingestion verification passed. |
| `pnpm run phase4:verify` | PASS | Phase 4 mock local AI verification passed. |
| `pnpm run phase4:integration` | PASS | Phase 4 integration verification passed. Node emitted existing `url.parse()` deprecation warnings. |
| `pnpm run pwa:verify` | PASS | PWA compliance verification passed. |

---

## 11. What Remains Blocked

The following remain blocked:

* Runtime validators.
* Hard-block line validation.
* App consumption of the market catalog config.
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

## 12. Next Recommended Phase

Proceed to **Phase 5.7 Add Bet Draft Boundary and Form State Contract** as a proposed next phase.

Phase 5.7 should stay narrow:

* Add type-only draft/form-state contracts for creating a bet.
* Keep Add Bet as a future primary action boundary.
* Use the Phase 5.5 contracts and Phase 5.6 config as inputs.
* Do not add UI/router files, runtime validators, storage, formulas, settlement logic, AI recommendation algorithms, or prediction algorithms.

Real AI training remains deferred to future Phase 7 and Phase 8 planning.
