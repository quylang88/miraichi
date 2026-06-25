# Phase 5.3 Wave A Technical Scope

This document defines technical scope for Phase 5.3 Wave A Implementation Planning. It is not an implementation specification.

---

## 1. Scope Status

* **Phase**: 5.3
* **Mode**: Implementation planning only
* **Implementation Status**: Not started
* **Owner Approval Required Before Execution**: Yes

---

## 2. In Scope

### TypeScript Tooling Planning

Plan the future TypeScript setup path:

* TypeScript dependency selection strategy.
* `tsconfig` layering strategy.
* Future typecheck command strategy.
* Gradual adoption strategy.
* `allowJs` or equivalent migration strategy discussion.

No TypeScript tooling is added in Phase 5.3.

### Typed Domain Contract Planning

Plan future typed shared contracts for:

* `BetRecordEnvelope`
* `MatchBettingGroup`
* `MarketType`
* `MarketDefinition`
* `LinePresetRegistry`
* `OddsFormat`
* `OddsValue`

No TypeScript contract files are created in Phase 5.3.

### Market Catalog and Line Preset Planning

Plan future configuration boundaries for:

* `1X2`
* `Over/Under`
* `Handicap`
* `Corners`
* `Custom Market`
* Manual line entry
* Warning-only non-0.25 line handling

No market config files are created in Phase 5.3.

### PWA Navigation Planning

Plan the future five-tab navigation shell:

* `Today`
* `Matches`
* `Bets`
* `Bankroll`
* `Miraichi`

No UI, router, HTML, CSS, or component files are created in Phase 5.3.

### Local-First Persistence and Backup Planning

Plan future persistence boundaries:

* Persistence adapter abstraction.
* IndexedDB as preferred future implementation target.
* Export/Import JSON backup.
* `localStorage` limited to tiny mock/demo state only.

No IndexedDB, export/import, storage library, database, schema, or migration code is created in Phase 5.3.

### Verification and Audit Planning

Plan future guard checks for:

* Formulas.
* DB/ORM/schema/migration.
* Bookmaker/payment integrations.
* AI recommendation algorithms.
* Prediction algorithms.
* Hard-coded competitions.
* JS-to-TS migration outside approved scope.

No verification scripts are created in Phase 5.3.

---

## 3. Out of Scope

Phase 5.3 explicitly excludes:

* Code implementation.
* Dependency installation.
* TypeScript tooling.
* `tsconfig` files.
* JS-to-TS migration.
* UI/router implementation.
* Final HTML/CSS.
* IndexedDB implementation.
* Export/import implementation.
* Database clients.
* ORM libraries.
* Schemas or migrations.
* Bookmaker/payment integrations.
* Secrets/API keys.
* Betting calculations.
* Profit/loss formulas.
* Odds conversion formulas.
* ROI/yield/CLV formulas.
* Settlement formulas.
* Stake-sizing/Kelly/bankroll/risk formulas.
* AI recommendation algorithms.
* Real prediction algorithms.
* Hard-coded real teams, real leagues, World Cup, FIFA, or real tournaments.

---

## 4. Boundary Rule

Owner-approved business decisions define what must be preserved. AI technical recommendations may propose implementation strategy, sequencing, file ownership, and verification approach. AI recommendations must not decide business logic, formulas, algorithms, providers, storage engine implementation, or framework selection.

---

## 5. Future Candidate File Ownership

These are future candidate locations only. They must not be created in Phase 5.3:

* Future typed contracts: `packages/shared`.
* Future market catalog config: `packages/config` or `packages/shared`, pending owner-approved implementation plan.
* Future navigation config: `apps/web`, pending framework and TypeScript/tooling approval.
* Future persistence adapter: `packages/shared` or `apps/web`, pending storage implementation approval.
* Future verification scripts: `scripts`, pending owner-approved execution plan.
