# Owner Decision Gates

* **Status**: Active Governance
* **Date**: 2026-06-23

---

## 1. Owner Control of Business Logic
All core business logic, prediction algorithms, risk boundaries, and bankroll rules in Miraichi are strictly controlled by the project owner. Under no circumstances may AI development agents unilaterally decide, configure, or hardcode final business logic calculations or operational boundaries.

---

## 2. Governance Rules & Decision Process

### Rule 1: Agent Proposal Limits
* AI agents may analyze the codebase, compile options, and recommend architectural directions.
* Final selection and approval of options must be explicitly given by the project owner before coding begins.

### Rule 2: Prediction Algorithm Authorization
* Designing or coding prediction inference algorithms, machine learning models, or probability engines requires a specific, owner-approved Architectural Decision Record (ADR).

### Rule 3: Betting, Bankroll, and Risk Calculations
* Simulating user betting, allocating budget bankrolls, or enforcing responsible-use risk limits (such as daily loss parameters) requires a specific, owner-approved ADR.

### Rule 4: Data Provider & Storage Selections
* Selecting a production match-data website or changing the production database engine requires a specific, owner-approved ADR.

---

## 3. Structural & Architectural Isolation Rules

* **Rule 5: Isolation & Replaceability**: All business logic must be isolated away from UI layouts and API controllers. Rules must be versioned, unit-tested, and replaceable (e.g. using the Strategy pattern).
* **Rule 6: UI and API Mediation Gateway Protection**: API route handlers (`apps/api`) and web pages (`apps/web`) are presentational and mediational channels. They must not contain mathematical calculations, risk rule evaluation code, or prediction criteria.
* **Rule 7: Strategy & Adapter Interfaces**: Future business logic must reside behind strict contract adapters and strategy interfaces to allow swapping algorithms without modifying calling service code.
