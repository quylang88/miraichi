# Extensible Betting Domain Architecture

This document defines the owner-applied architectural boundaries for the betting domain. All modules remain decoupled, replaceable, and competition-agnostic, satisfying the requirements of `docs/governance/OWNER-DECISION-GATES.md`.

This document is planning-only. It does not implement business logic, formulas, storage, AI recommendation logic, or final ADR decisions.

---

## 1. BetRecordEnvelope

* **Purpose**: Standard container for a single wager's owner-approved candidate fields, trace references, metadata, and state.
* **What it owns**: Core bet fields, optional live fields, optional trace fields, notes, tags, and signed nullable `profitLossPoints`.
* **What it must not own**: Mathematical formulas, line validation logic, persistence implementation, prediction logic, bankroll/risk logic, settlement logic, or AI recommendation logic.
* **How to extend later**: Add future optional fields only through owner-approved ADR updates.
* **Related candidate**: ADR-0023.
* **Owner-applied generic shape**:
  ```json
  {
    "betId": "bet_789012",
    "matchGroupId": "match_group_345",
    "createdAt": "2026-06-24T12:00:00Z",
    "betTimeType": "pre_match",
    "homeTeamName": "Team Alpha",
    "awayTeamName": "Team Beta",
    "marketType": "over_under",
    "selectionLabel": "over",
    "oddsFormat": "HK",
    "oddsValue": 0.85,
    "stakePoints": 10.0,
    "status": "pending",
    "profitLossPoints": null,
    "notes": "metadata only",
    "tags": ["manual-review"],
    "predictionTraceId": "pred_trace_xyz123"
  }
  ```

---

## 2. MatchBettingGroup

* **Purpose**: Aggregate multiple wagers associated with a single match for grouped display and assessment.
* **What it owns**: `matchGroupId` as source of truth, optional `matchId`, optional kickoff/competition/season/status labels, and associated bet references.
* **What it must not own**: Individual bet formulas, sports scoring logic, feed matching implementation, or final grouping by normalized team names.
* **How to extend later**: Add owner-approved match summary fields after reporting and settlement rules are approved.
* **Related candidate**: ADR-0024.
* **Owner-applied generic shape**:
  ```json
  {
    "matchGroupId": "match_group_345",
    "matchId": null,
    "homeTeamName": "Team Alpha",
    "awayTeamName": "Team Beta",
    "kickoffTime": "2026-06-24T12:00:00Z",
    "competitionLabel": "Competition Alpha",
    "seasonLabel": "Season 1",
    "bets": ["bet_789012", "bet_789013"],
    "groupStatus": "active"
  }
  ```
* **Grouping rule**: Team-name normalization may support suggestions/autocomplete only. It must not be final grouping logic.

---

## 3. MarketCatalog

* **Purpose**: Maintain the register of supported markets and coordinate display/preset metadata.
* **What it owns**: Owner-approved v1 baseline market list and deferred market families.
* **What it must not own**: Individual market payout formulas or settlement logic.
* **How to extend later**: Register future markets dynamically through owner-approved configuration or strategy boundaries.
* **Related candidate**: ADR-0025.
* **V1 baseline**: 1X2, Over/Under, Handicap, Corners, Custom Market.
* **Deferred**: Cards, Team Totals, First Half, BTTS, player props, exact score, and other detailed market families.

---

## 4. MarketTypeRegistry

* **Purpose**: Map market identifiers to display metadata and future validation boundaries.
* **What it owns**: Associations between market IDs and owner-approved validation warning boundaries.
* **What it must not own**: Hardcoded bet instance variables or settlement formulas.
* **How to extend later**: Add registered validators after ADR approval.
* **Related candidate**: ADR-0025.
* **Owner-applied rule**: Non-standard 0.25 line increments should warn but not block save. Manual line entry must always be allowed.

---

## 5. LinePresetRegistry

* **Purpose**: Supply configurable quick-select line values in UI forms based on market category.
* **What it owns**: Configurable preset values per market ID.
* **What it must not own**: The user's input line buffer or blocking validation logic.
* **How to extend later**: Add user-configurable or owner-approved market presets.
* **Related candidate**: ADR-0025.

---

## 6. OddsFormatAdapter

* **Purpose**: Preserve raw HK odds in v1 and isolate future conversion behavior.
* **What it owns**: `oddsFormat`, raw odds, and optional `normalizedOddsValue` as a future target/internal field.
* **What it must not own**: Conversion formulas until explicitly approved.
* **How to extend later**: Add Decimal, Malay, Indonesian, or American conversion after a later owner-approved ADR.
* **Related candidate**: ADR-0026.
* **Owner-applied rule**: HK is the only visible odds format in the first implementation.

---

## 7. StakeUnitPolicy

* **Purpose**: Define points-only stake unit policy.
* **What it owns**: Positive stake constraint and 2-decimal stake precision.
* **What it must not own**: UI warning logic, bankroll state, stake-sizing helpers, or risk formulas.
* **How to extend later**: Add future owner-approved unit policies if the product expands.
* **Related candidate**: ADR-0027.
* **Owner-applied rule**: `profitLossPoints` is signed and nullable while pending.

---

## 8. SettlementStrategy

* **Purpose**: Isolate future profit/loss behavior after formulas are owner-approved.
* **What it owns**: Future owner-approved settlement calculation boundaries.
* **What it must not own**: Score fetching, user storage updates, auto-settlement from feed data, or formulas before approval.
* **How to extend later**: Add formula strategies only after explicit owner approval.
* **Related candidate**: ADR-0028.
* **Owner-applied statuses**: `pending`, `won`, `lost`, `push`, `void`, `half_won`, `half_lost`, `manual_adjustment`.
* **Deferred**: Auto-settlement and all settlement formulas.

---

## 9. ReportAggregator

* **Purpose**: Generate owner-approved candidate report fields for daily, weekly, and monthly views.
* **What it owns**: Candidate grouping metrics over browser-local report periods, using UTC stored timestamps.
* **What it must not own**: UI styling, persistent storage files, SQL queries, ROI/yield/CLV formulas, bankroll curve logic, or advanced charts.
* **How to extend later**: Add custom charts or deferred metrics only after owner approval.
* **Related candidate**: ADR-0029.
* **Deferred**: ROI, yield, CLV, bankroll curve, advanced charts, and storage queries.

---

## 10. AiRecommendationBoundary

* **Purpose**: Isolate AI recommendation presentation from journal writes.
* **What it owns**: Read-only recommendation card boundaries, trace references when available, and no-bet/refusal state planning.
* **What it must not own**: Prediction calculations, ranking logic, real confidence claims, stake suggestions, auto-save, auto-bet, or bankroll-based recommendation.
* **How to extend later**: Connect to approved prediction envelopes only after prediction ADR approval.
* **Related candidate**: ADR-0030.
* **Owner-applied generic shape**:
  ```json
  {
    "recommendationId": "rec_112233",
    "predictionTraceId": "pred_xyz987",
    "predictionAvailable": true,
    "suggestedMarket": { "type": "1X2", "selection": "home" },
    "suggestedLine": null
  }
  ```

---

## 11. RiskRuleStrategy

* **Purpose**: Plan future warning-only responsible-use checks behind a replaceable boundary.
* **What it owns**: Future owner-approved warning indicators.
* **What it must not own**: Enforcement locks, default numeric thresholds, Kelly Criterion, stake-sizing helpers, bankroll growth formulas, max drawdown formulas, or risk formulas.
* **How to extend later**: Add warning modules for high stake compared to bankroll, daily loss warning, weekly loss warning, and loss streak warning after owner threshold approval.
* **Related candidate**: ADR-0032.
* **Owner-applied rule**: Warnings are overrideable and non-blocking in v1 planning.

---

## 12. ResponsibleUseBoundary

* **Purpose**: Document future responsible-use warning categories.
* **What it owns**: Future warning categories only.
* **What it must not own**: User financial details, hard locks, formulas, or default numeric thresholds.
* **How to extend later**: Implement hard locks only if explicitly approved in a later owner decision.
* **Related candidate**: ADR-0032.

---

## 13. LocalFirstPersistenceBoundary

* **Purpose**: Plan local-first data ownership, backup, and future storage boundaries for betting history.
* **What it owns**: Export/Import JSON backup requirement and future local-first storage planning.
* **What it must not own**: Production database implementation, account system, auth, cloud sync, database client, object mapper, table definition, or migration.
* **How to extend later**: Plan IndexedDB implementation after owner-approved ADR drafting.
* **Related candidate**: ADR-0033.
* **Owner-applied rule**: `localStorage` can be used only for tiny mock/demo state, not long-term real betting history.
