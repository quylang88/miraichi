# Phase 5.3 Wave A Implementation Plan

> **For agentic workers:** This is an implementation planning document only. Do not execute these workstreams until the owner approves a later implementation execution plan.

**Goal:** Define the future implementation plan for Phase 5.3 Wave A foundations without starting implementation.

**Architecture:** Phase 5.3 turns accepted Wave A ADRs into executable future workstreams while preserving owner control over business logic. Work is sequenced so TypeScript tooling, typed contracts, market config, navigation, persistence, and verification remain isolated and reviewable.

**Tech Stack:** Current repository uses JavaScript/ESM, pnpm workspaces, `apps/*`, and `packages/*`. TypeScript is accepted as a future technical direction only; no TypeScript tooling is installed in this phase.

---

## 1. Source Decisions

Phase 5.3 is based on the accepted architecture and planning boundaries in:

* `ADR-0023`: `BetRecordEnvelope`
* `ADR-0024`: `MatchBettingGroup`
* `ADR-0025`: `MarketCatalog` and `LinePresetRegistry`
* `ADR-0026`: HK-only v1 `OddsFormat`
* `ADR-0031`: PWA five-tab navigation backbone
* `ADR-0033`: local-first persistence and backup boundary
* `ADR-0034`: TypeScript adoption and typed domain contracts boundary

Accepted ADRs authorize planning only. They do not authorize implementation, dependencies, UI/router files, storage code, formulas, algorithms, integrations, or real prediction/recommendation logic.

---

## 2. Owner-Approved Business Decisions

The owner-approved business decisions for this planning phase are:

* User-entered wager records use a `BetRecordEnvelope` boundary.
* Match-centric history uses a `MatchBettingGroup` boundary.
* V1 market baseline includes `1X2`, `Over/Under`, `Handicap`, `Corners`, and `Custom Market`.
* Manual line entry must always be allowed.
* Non-0.25 line values may trigger warning-only behavior, not save-blocking behavior.
* HK odds is the only visible v1 odds format.
* Five primary PWA tabs are `Today`, `Matches`, `Bets`, `Bankroll`, and `Miraichi`.
* `Add Bet` is the fastest primary action, not a primary navigation tab.
* Local-first persistence and JSON backup are planned boundaries.
* IndexedDB is preferred for future implementation planning.
* TypeScript is accepted as a technical direction for future typed contracts and gradual adoption.

---

## 3. AI Technical Recommendations

The AI technical recommendations are:

* Plan TypeScript tooling before adding TypeScript dependencies or `tsconfig` files.
* Implement typed shared contracts before app-specific TypeScript migration.
* Keep runtime validation separate from static TypeScript types.
* Keep market catalog and line preset config separate from settlement or formula logic.
* Keep navigation metadata centralized using the project-approved language/runtime.
* Keep persistence behind an adapter boundary so local and future remote storage remain replaceable.
* Add verification checks before implementation execution to catch formulas, database/ORM additions, provider integrations, secrets, and hard-coded competitions.

---

## 4. Workstream A: TypeScript Tooling Planning

**Based on:** ADR-0034.

**Purpose:** Prepare a future TypeScript tooling implementation plan without installing TypeScript or changing runtime files.

**Future files to consider after owner approval:**

* `package.json` for future typecheck script wiring.
* `pnpm-workspace.yaml` only if workspace package layout changes are approved.
* Future root or layered `tsconfig` files after explicit owner approval.

**Planning decisions to make before execution:**

* Exact TypeScript version.
* Whether root config is single-file or layered by package.
* Whether `allowJs` is used during migration.
* Whether typechecking is repository-wide or package-scoped first.
* Which CI command will run typechecks.

**Boundaries:**

* Do not install TypeScript.
* Do not add `tsconfig` files.
* Do not migrate JavaScript.
* Do not choose React, Next.js, Vite, Svelte, Vue, or any frontend framework.
* Do not choose Express, Fastify, Hono, NestJS, or any backend framework.

---

## 5. Workstream B: Typed Domain Contract Planning

**Based on:** ADR-0023, ADR-0024, ADR-0025, ADR-0026, ADR-0034.

**Purpose:** Plan future typed contracts for shared domain boundaries.

**Future contract candidates:**

* `BetRecordEnvelope`
* `MatchBettingGroup`
* `MarketType`
* `MarketDefinition`
* `LinePresetRegistry` shape
* `OddsFormat`
* `OddsValue` fields

**Recommended future location after TypeScript tooling approval:**

* `packages/shared` for domain contracts shared by apps.
* Keep contract exports stable and package-owned.

**Boundaries:**

* Do not write the contracts yet.
* Do not implement validators yet.
* Keep runtime validation separate from static types.
* Do not encode settlement formulas, odds conversion formulas, ROI/yield/CLV, stake-sizing, bankroll, risk, prediction, or recommendation logic in types.

---

## 6. Workstream C: Market Catalog and Line Preset Planning

**Based on:** ADR-0025.

**Purpose:** Plan future config-driven market and line preset boundaries.

**V1 markets:**

* `1X2`
* `Over/Under`
* `Handicap`
* `Corners`
* `Custom Market`

**Future planning shape:**

* `MarketCatalog` stores market definitions and user-facing labels.
* `LinePresetRegistry` stores configurable line presets.
* `Custom Market` remains a free-text escape hatch.
* Manual line entry always remains available.
* Non-0.25 line values produce warning-only behavior.

**Boundaries:**

* Do not implement market config yet.
* Do not implement line presets yet.
* Do not implement settlement logic.
* Do not add hard-block validators.
* Do not encode market-specific calculations.

---

## 7. Workstream D: PWA Navigation Planning

**Based on:** ADR-0031.

**Purpose:** Plan the future five-tab PWA navigation backbone.

**Primary tabs:**

* `Today`
* `Matches`
* `Bets`
* `Bankroll`
* `Miraichi`

**Future planning shape:**

* Use a centralized navigation configuration module using the project-approved language/runtime.
* If ADR-0034 tooling is approved later, the module may be implemented in TypeScript.
* Keep route IDs stable: `today`, `matches`, `bets`, `bankroll`, `miraichi`.
* Keep `Add Bet` as a primary action, not a primary tab.
* Keep calendar-first UX and native wrapper work deferred.

**Boundaries:**

* Do not implement UI/router code.
* Do not create final HTML/CSS.
* Do not implement real AI cards.
* Do not add app routes, components, or navigation config files in Phase 5.3.

---

## 8. Workstream E: Local-First Persistence and Backup Planning

**Based on:** ADR-0033.

**Purpose:** Plan future local-first persistence and backup execution without adding storage code.

**Future planning shape:**

* A persistence adapter boundary should isolate storage operations.
* IndexedDB is preferred for future implementation planning.
* Export/Import JSON backup is required.
* `localStorage` may be used only for tiny mock/demo state, not real betting history.
* Backup payloads should be versioned when implementation is later approved.

**Boundaries:**

* Do not implement IndexedDB.
* Do not implement export/import.
* Do not add storage libraries.
* Do not create database clients.
* Do not create schemas or migrations.
* Do not add auth, cloud sync, or account systems.

---

## 9. Workstream F: Verification and Audit Planning

**Purpose:** Plan future checks that guard implementation execution.

**Future verification targets:**

* No formulas.
* No DB/ORM/schema/migration.
* No bookmaker/payment integration.
* No AI recommendation algorithm.
* No prediction algorithm.
* No hard-coded competitions.
* No JS-to-TS migration outside approved scope.
* No TypeScript tooling before owner approval.
* No UI/router implementation before owner approval.
* No storage adapter implementation before owner approval.

**Boundaries:**

* Do not implement verification scripts in Phase 5.3.
* Do not add npm scripts in Phase 5.3.
* Do not change package manifests.

---

## 10. Phase 5.3 Exit Criteria

Phase 5.3 is complete when:

* All Phase 5.3 planning docs exist.
* Workstreams A-F are documented.
* Future sequencing is documented.
* Guardrails are documented.
* Open questions are documented.
* Readiness review confirms no implementation started.

Phase 5.3 completion does not authorize Phase 5.4 execution. The owner must approve the next execution plan first.
