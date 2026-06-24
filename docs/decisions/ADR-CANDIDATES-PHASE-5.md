# Architectural Decision Record Candidates: Phase 5 Betting Journal and Business Logic

This document compiles the candidate Architectural Decision Records (ADRs) proposed to open Phase 5. Under `docs/governance/OWNER-DECISION-GATES.md`, all candidates require explicit owner approval before implementation begins. Any recommendation in this file is an AI proposal only, not an owner decision and not an ADR status.

---

## ADR-0023: User-Entered Real Bet Record Boundary (Candidate)

### 1. Problem
Users need a structured format to log wagers they have placed or want to track. Loose json files make validations and reports unreliable.

### 2. Owner Requirement
The app must allow users to manually record real bets they have placed or want to track.

### 3. Options Considered
* **Option A**: Log wagers as free-text fields (no schema validation).
* **Option B (AI Proposal)**: Define a strict candidate data contract `BetRecordEnvelope` enclosing identifiers, trace keys, and stakes.
* **Option C**: Create database models directly.

### 4. AI Proposed Direction & Trade-offs
* **Direction**: Option B. Standardizes data storage and validation while leaving database drivers abstract.
* **Trade-off**: Requires writing local verification code for the fields.

### 5. Open Questions
* Should we allow custom tags or categorization? (AI proposal: Yes, pending owner confirmation).

### 6. What It Must NOT Decide Yet
* Production SQL or NoSQL database schemas or ORM packages.

### 7. What Implementation It May Unlock Later
* Storing bets in IndexedDB or syncing to a cloud database.

---

## ADR-0024: Match-Centric Betting History Grouping (Candidate)

### 1. Problem
Users frequently place multiple distinct wagers on the same match. Listing wagers as a flat chronological feed without match context makes records confusing.

### 2. Owner Requirement
The app must store betting history by match. Multiple bets for the same match should be grouped under the same match.

### 3. Options Considered
* **Option A**: Store bets as flat records with a simple match text field (no grouping).
* **Option B (AI Proposal)**: Create a `MatchBettingGroup` envelope that references a Match ID when available, while preserving a manual grouping fallback, and contains references to associated `BetRecordEnvelope` records.
* **Option C**: Group bets only in frontend presentations, keeping the storage data flat.

### 4. AI Proposed Direction & Trade-offs
* **Direction**: Option B. Ensures data grouping is represented in the domain architecture, making reports simpler to aggregate.
* **Trade-off**: Requires maintaining relationships between wagers and match groups.

### 5. Open Questions
* How do we handle grouping if the user types team names with different spellings? (AI proposal: define owner-approved normalization rules before implementation).

### 6. What It Must NOT Decide Yet
* Enforcing database foreign-key constraints.

### 7. What Implementation It May Unlock Later
* Match-level summary metrics (e.g. net profit/loss per match).

---

## ADR-0025: Market Catalog and Line Preset Registry (Candidate)

### 1. Problem
Adding new markets or validating manual line inputs can bloat code if wagers are hardcoded.

### 2. Owner Requirement
The user must be able to select markets (1X2, Over/Under, Handicap, Corners, etc.) with presets or manual line entry.

### 3. Options Considered
* **Option A**: Hardcode validation checks per market inside the main transaction route.
* **Option B (AI Proposal)**: Establish a `MarketCatalog` and `MarketTypeRegistry` where each market is a registered module defining presets and verification checks.
* **Option C**: No line presets (manual-only input).

### 4. AI Proposed Direction & Trade-offs
* **Direction**: Option B. Decouples validation code from record logic.
* **Trade-off**: Minor configuration overhead.

### 5. Open Questions
* Which preset values are loaded by default? (AI proposal: use common line presets, with exact values requiring owner confirmation).

### 6. What It Must NOT Decide Yet
* The exact calculation logic for settlements of specific new markets.

### 7. What Implementation It May Unlock Later
* Dynamic loading of custom market types from third-party configuration files.

---

## ADR-0026: Odds Format Strategy Boundary (Candidate)

### 1. Problem
Converting between different formats (HK, Decimal, Malay, American) can introduce bugs and rounding discrepancies if scattered across the codebase.

### 2. Owner Requirement
Default odds format must be HK odds, with support for switching to other common formats later.

### 3. Options Considered
* **Option A**: Convert values dynamically in the UI elements.
* **Option B (AI Proposal)**: Preserve user-entered odds format and plan a unified `OddsFormatAdapter` boundary for future owner-approved normalization rules.
* **Option C**: Force all wagers to be saved and viewed as Decimal only.

### 4. AI Proposed Direction & Trade-offs
* **Direction**: Option B. Keeps calculations isolated.
* **Trade-off**: Requires writing parsing adapters.

### 5. Open Questions
* What is the decimal precision limit for internal odds multipliers? (AI proposal: choose an owner-approved precision limit before implementation).

### 6. What It Must NOT Decide Yet
* The actual mathematical conversion formulas for Malay or American odds.

### 7. What Implementation It May Unlock Later
* Clean format switching in the user's dashboard view.

---

## ADR-0027: Stake Points and Profit/Loss Boundary (Candidate)

### 1. Problem
Real currency wagering adds compliance, payment, and security risks.

### 2. Owner Requirement
Stakes and profit/loss in v1 must be points, not real currency.

### 3. Options Considered
* **Option A**: Store stakes as arbitrary strings.
* **Option B (AI Proposal)**: Use points-only stake and profit/loss fields, with positive stake values and owner-approved precision.
* **Option C**: Allow real currency inputs alongside points in v1.

### 4. AI Proposed Direction & Trade-offs
* **Direction**: Option B. Protects users by keeping transactions mock-only.
* **Trade-off**: Limits applicability to cash tracking.

### 5. Open Questions
* Can points contain decimals? (AI proposal: Yes, with precision confirmed by the owner).

### 6. What It Must NOT Decide Yet
* Formulas for ROI, yield, or payout ratios.

### 7. What Implementation It May Unlock Later
* Simple conversion to real currencies if authorized by the owner in v2.

---

## ADR-0028: Bet Lifecycle and Settlement Boundary (Candidate)

### 1. Problem
Automatically resolving wagers requires complex feed parsing, while manual-only tracking is error-prone.

### 2. Owner Requirement
Users must be able to track wagers, supporting live wagers and status resolution.

### 3. Options Considered
* **Option A**: Pure manual status updates.
* **Option B (AI Proposal)**: Define owner-approved lifecycle states that support manual toggles and future auto-settlement hooks via a `SettlementStrategy` boundary.
* **Option C**: Fully automated background settlement script only.

### 4. AI Proposed Direction & Trade-offs
* **Direction**: Option B. Offers safety of manual control with modular hooks for automation.
* **Trade-off**: Requires mapping split result outcomes.

### 5. Open Questions
* Should settlement recalculate profit/loss on modification? (AI proposal: require a separate owner-approved formula ADR before any recalculation behavior is implemented).

### 6. What It Must NOT Decide Yet
* Implementing automated score parsing from external feeds.

### 7. What Implementation It May Unlock Later
* Semi-automated settlement based on ingested match goals.

---

## ADR-0029: Reporting Aggregation Boundary (Candidate)

### 1. Problem
Aggregating reports dynamically in frontend controllers degrades rendering performance.

### 2. Owner Requirement
Provide daily, weekly, and monthly reports.

### 3. Options Considered
* **Option A**: Implement hardcoded loops inside the UI rendering logic.
* **Option B (AI Proposal)**: Abstract aggregation behavior to a separate `ReportAggregator` boundary, returning an owner-approved report envelope later.
* **Option C**: Pre-calculate and store reports in database collection records.

### 4. AI Proposed Direction & Trade-offs
* **Direction**: Option B. Decouples math and presentation.
* **Trade-off**: Slightly increases model complexity.

### 5. Open Questions
* Should reporting use UTC or local device timezone? (AI proposal: use the user's local reporting period while preserving UTC event timestamps).

### 6. What It Must NOT Decide Yet
* SQL queries or database views for aggregation.

### 7. What Implementation It May Unlock Later
* Caching aggregated reports in IndexedDB for offline capabilities after a separate storage decision.

---

## ADR-0030: AI Betting Recommendation Boundary (Candidate)

### 1. Problem
Allowing AI to suggest wagers without strict auditability makes it impossible to verify predictions or track performance.

### 2. Owner Requirement
The app should eventually allow AI to suggest bets.

### 3. Options Considered
* **Option A**: Let AI directly write wager records into the user's history log.
* **Option B (AI Proposal)**: Enforce an isolated recommendation boundary where AI suggestions are read-only cards that the user must manually confirm, containing trace references.
* **Option C**: Pure text suggestions in chat.

### 4. AI Proposed Direction & Trade-offs
* **Direction**: Option B. Maintains strict user control and auditability.
* **Trade-off**: Requires designing recommendation presentation cards.

### 5. Open Questions
* How long should recommendation cards persist? (AI proposal: owner should choose a lifecycle rule before implementation).

### 6. What It Must NOT Decide Yet
* The prediction inference or model selection algorithms.

### 7. What Implementation It May Unlock Later
* Auditing AI recommendation win rates against actual user wagers.

---

## ADR-0031: PWA Betting Journal UX Boundary (Candidate)

### 1. Problem
Responsive layout issues can break form inputs and dashboards on mobile screens.

### 2. Owner Requirement
Phase 5 should include UI/UX design for the PWA betting journal and reporting flow.

### 3. Options Considered
* **Option A**: Simple desktop-first dashboard with scrollbars on mobile.
* **Option B (AI Proposal)**: Mobile-first responsive layouts with touch-friendly controls and PWA-safe spacing.
* **Option C**: Native application view (requires wrappers).

### 4. AI Proposed Direction & Trade-offs
* **Direction**: Option B. Ensures high mobile usability under PWA guidelines.
* **Trade-off**: Requires writing media queries and responsive styling.

### 5. Open Questions
* Should we support light and dark modes? (AI proposal: choose the default theme during owner review).

### 6. What It Must NOT Decide Yet
* Final framework selections or page routing libraries.

### 7. What Implementation It May Unlock Later
* Creating Android/iOS packages using Capacitor or Cordova.

---

## ADR-0032: Bankroll and Risk Strategy Boundary (Candidate)

### 1. Problem
Users may place bets that violate sensible risk limits, leading to rapid bankroll depletion.

### 2. Owner Requirement
Design bankroll boundaries that support future adjustments and rules without locking in v1.

### 3. Options Considered
* **Option A**: No bankroll limit checks (unrestricted tracking).
* **Option B (AI Proposal)**: Design a replaceable `RiskRuleStrategy` boundary that can generate UI warnings only after the owner approves exact guidelines.
* **Option C**: Hard block entries that violate owner-approved risk rules.

### 4. AI Proposed Direction & Trade-offs
* **Direction**: Option B. Helps user risk management without forcing restrictive blocks.
* **Trade-off**: Increases interface complexity.

### 5. Open Questions
* What is the default risk limit warning threshold? (AI proposal: defer exact thresholds until owner review).

### 6. What It Must NOT Decide Yet
* Math formulas for bankroll growth or maximum drawdowns.

### 7. What Implementation It May Unlock Later
* Custom, user-configured responsible gambling alerts.
