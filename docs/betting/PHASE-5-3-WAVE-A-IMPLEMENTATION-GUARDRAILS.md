# Phase 5.3 Wave A Implementation Guardrails

These guardrails apply to Phase 5.3 planning and any later Wave A execution proposal.

---

## 1. Non-Negotiable Phase 5.3 Rule

Phase 5.3 is implementation planning only.

No code, dependencies, config files, UI/router files, storage code, formulas, algorithms, integrations, schemas, migrations, or secrets may be added in Phase 5.3.

---

## 2. Owner Decision Separation

Owner-approved business decisions:

* `BetRecordEnvelope` boundary.
* `MatchBettingGroup` boundary.
* V1 market baseline.
* HK-only v1 odds boundary.
* Five-tab PWA navigation backbone.
* Local-first persistence and backup boundary.
* TypeScript as future technical direction.

AI technical recommendations may cover:

* Future sequencing.
* Future file ownership.
* Future package boundaries.
* Future test strategy.
* Future verification strategy.
* Future typechecking strategy.

AI technical recommendations must not decide:

* Business formulas.
* Prediction algorithms.
* Recommendation algorithms.
* Provider choices.
* Production database selection.
* Framework selection.
* Risk thresholds.
* Settlement rules.

---

## 3. Forbidden During Phase 5.3

Do not:

* Implement code.
* Install dependencies.
* Add TypeScript tooling.
* Add `tsconfig` files.
* Rename `.js` files to `.ts`.
* Add UI/router implementation.
* Add IndexedDB code.
* Add export/import code.
* Add database clients.
* Add ORM libraries.
* Create schemas or migrations.
* Add bookmaker/payment integrations.
* Add secrets/API keys.
* Implement betting calculations.
* Implement profit/loss formulas.
* Implement odds conversion formulas.
* Implement ROI/yield/CLV formulas.
* Implement settlement formulas.
* Implement stake-sizing/Kelly/bankroll/risk formulas.
* Implement AI recommendation algorithms.
* Implement real prediction algorithms.
* Hard-code real teams, real leagues, World Cup, FIFA, or real tournaments.

---

## 4. Required Future Review Checks

Any later execution plan must include checks for:

* No formulas.
* No DB/ORM/schema/migration.
* No bookmaker/payment integration.
* No AI recommendation algorithm.
* No prediction algorithm.
* No hard-coded competitions.
* No JS-to-TS migration outside approved scope.
* No TypeScript tooling outside approved scope.
* No UI/router code outside approved scope.
* No persistence implementation outside approved scope.

---

## 5. Competition-Agnostic Rule

All future plans and implementations must use generic football domain language. Do not hard-code real teams, real leagues, real tournaments, World Cup, FIFA, or event-specific tournament rules.

---

## 6. Runtime Validation Rule

TypeScript types, if approved later, do not replace runtime validation. Future plans must treat static types and runtime validation as separate layers:

* Static types describe compile-time contract shape.
* Runtime validation protects user input, imported JSON, API payloads, and persistence boundaries.

---

## 7. Storage Rule

Local-first persistence is an accepted boundary, not an implementation authorization.

* IndexedDB is preferred for future planning.
* `localStorage` is limited to tiny mock/demo state.
* Export/Import JSON backup is required in future planning.
* No storage code may be written until the owner approves an implementation plan.
