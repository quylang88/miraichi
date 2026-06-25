# Phase 5.2 Wave A Draft Scope

This document specifies the exact scope boundaries and contents for the Wave A ADR draft phase.

## 1. Included Draft ADRs

Wave A encompasses exactly six business/presentation candidate ADR files to be created in `Draft` status:

| ADR ID | Title | Scope and Boundaries |
| :--- | :--- | :--- |
| **ADR-0023** | User-Entered Real Bet Record Boundary | Defines the candidate JSON properties of `BetRecordEnvelope`. |
| **ADR-0024** | Match-Centric Betting History Grouping | Defines grouping by match and the `MatchBettingGroup` object. |
| **ADR-0025** | Market Catalog and Line Preset Registry | Configures the list of standard football markets and UI lines presets. |
| **ADR-0026** | Odds Format Strategy Boundary | Sets HK odds as default and raw odds value storage, deferring conversion math. |
| **ADR-0031** | PWA Betting Journal UX Boundary | Outlines navigation tabs, date groupings, list views, and PWA considerations. |
| **ADR-0033** | Local-First Betting Data Persistence Boundary | Specifies local-first IndexedDB strategy, backups, and data privacy. |

Technical adjunct:

| ADR ID | Title | Scope and Boundaries |
| :--- | :--- | :--- |
| **ADR-0034** | TypeScript Adoption and Typed Domain Contracts Boundary | Recommends TypeScript as a technical architecture direction for future typed contracts. It does not authorize tooling, dependencies, config files, migration, frameworks, databases, formulas, or algorithms. |

---

## 2. Explicit Exclusions

The following components are strictly out-of-scope for Wave A and will not be drafted in these ADRs:
1. **Mathematical Calculations**: Any profit/loss, yield, ROI, stake sizing, or odds conversion formulas.
2. **Execution Code / DB Tables**: No code files, library installations (e.g. SQLite, Sequelize), database drivers, or migration scripts.
3. **External Integrations**: Bookmaker APIs, data feeds, account creation, or email services.
4. **Active AI recommendation features**: Actual card suggestion logic or probability threshold triggers.
5. **TypeScript implementation**: No TypeScript installation, package dependency changes, `tsconfig` files, JS-to-TS migration, build pipeline changes, or typecheck command wiring.

---

## 3. Governance Status

* **Accepted After Owner Review**: ADR-0023, ADR-0024, ADR-0025, ADR-0026, ADR-0031, ADR-0033, and ADR-0034 were accepted on 2026-06-24 as architecture and planning boundaries.
* **No Implementation**: Coding remains blocked.
* **Technical ADR Separation**: ADR-0034 is a technical architecture ADR only. It must not become a vehicle for business logic, toolchain installation, or framework selection.
