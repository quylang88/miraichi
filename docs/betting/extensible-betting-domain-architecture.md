# Extensible Betting Domain Architecture

This document defines the architectural boundaries, contracts, and interfaces for the betting domain. All modules are designed to be decoupled, replaceable, and competition-agnostic, satisfying the requirements of `docs/governance/OWNER-DECISION-GATES.md`.

---

## 1. BetRecordEnvelope
* **Purpose**: A standard container enclosing a single wager's parameters, trace references, audit data, and state.
* **What it owns**: Bet ID, match association, market definition, stake, odds, timestamps, trace references, notes, tags, and status.
* **What it must not own**: The mathematical formulas to convert odds, the validation logic of lines, or database serialization methods.
* **How to extend later**: Add new keys to the `trace` or `metadata` maps without modifying properties.
* **Owner decisions required**: Final approval of candidate fields (ADR-0023).
* **Example generic shape**:
  ```json
  {
    "betId": "bet_789012",
    "matchGroupId": "match_group_345",
    "market": {
      "type": "over_under",
      "line": 2.5
    },
    "odds": {
      "format": "HK",
      "rawValue": 0.85
    },
    "stake": {
      "unit": "points",
      "value": 10.0
    },
    "status": "pending",
    "trace": {
      "predictionTraceId": "pred_trace_xyz123"
    }
  }
  ```

---

## 2. MatchBettingGroup
* **Purpose**: Aggregate multiple wagers associated with a single match for grouped display and assessment.
* **What it owns**: Match ID, overall group status, and list of associated `BetRecordEnvelope` instances.
* **What it must not own**: Individual bet calculation formulas or sports scoring logic.
* **How to extend later**: Add aggregations (e.g., net yield per match) to a `summary` property.
* **Owner decisions required**: Match lifecycle rules and states (ADR-0024).
* **Example generic shape**:
  ```json
  {
    "matchGroupId": "match_group_345",
    "matchId": "match_45678",
    "homeTeamName": "Team Alpha",
    "awayTeamName": "Team Beta",
    "bets": ["bet_789012", "bet_789013"],
    "groupStatus": "active"
  }
  ```

---

## 3. MarketCatalog
* **Purpose**: Maintain the register of supported markets and coordinate validators.
* **What it owns**: List of active markets and their display configuration.
* **What it must not own**: Individual market payout formulas or line presets.
* **How to extend later**: Register custom markets dynamically via config arrays.
* **Owner decisions required**: Valid MVP market types (ADR-0025).
* **Example generic shape**:
  ```json
  {
    "supportedMarkets": [
      { "id": "1X2", "name": "Full Time Result" },
      { "id": "over_under", "name": "Total Goals" }
    ]
  }
  ```

---

## 4. MarketTypeRegistry
* **Purpose**: Map market identifiers to their corresponding validation rules and settlement formulas.
* **What it owns**: Matchers associating market ID with parsing code.
* **What it must not own**: Hardcoded bet instance variables.
* **How to extend later**: Implement a plugin loader that registers new classes implementing `IMarketValidator`.
* **Owner decisions required**: Market validation strictness levels.
* **Example generic shape**:
  ```javascript
  class MarketTypeRegistry {
    constructor() { this.validators = new Map(); }
    register(marketType, validatorInstance) {
      this.validators.set(marketType, validatorInstance);
    }
    getValidator(marketType) { return this.validators.get(marketType); }
  }
  ```

---

## 5. LinePresetRegistry
* **Purpose**: Supply quick-select line values in UI forms based on market category.
* **What it owns**: Preset values per market ID.
* **What it must not own**: The user's input line buffer.
* **How to extend later**: Add league-specific presets via config files.
* **Owner decisions required**: Preset lists for standard lines (ADR-0025).
* **Example generic shape**:
  ```json
  {
    "presets": {
      "over_under": [0.5, 1.0, 1.5, 2.0, 2.25, 2.5, 2.75, 3.0],
      "handicap": [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5]
    }
  }
  ```

---

## 6. OddsFormatAdapter
* **Purpose**: Standardize conversion between input format styles and the normalized decimal multiplier.
* **What it owns**: Translation maps and interface methods.
* **What it must not own**: Specific math formulas until approved.
* **How to extend later**: Write new adapter subclasses (e.g. `MalayOddsAdapter`).
* **Owner decisions required**: Conversion rules and rounding tolerances (ADR-0026).
* **Example generic shape**:
  ```javascript
  interface IOddsFormatAdapter {
    toDecimalMultiplier(rawValue);
    fromDecimalMultiplier(decimalValue);
  }
  ```

---

## 7. StakeUnitPolicy
* **Purpose**: Define units, minimum/maximum limits, and precision parameters for stakes.
* **What it owns**: Staking restrictions (minimum limits, fractional points).
* **What it must not own**: UI validation alerts or current user balance.
* **How to extend later**: Add currency policies if points-based wagers are expanded.
* **Owner decisions required**: Limit values (ADR-0027).
* **Example generic shape**:
  ```json
  {
    "stakePolicy": {
      "unit": "points",
      "minStake": 0.1,
      "maxStake": 10000.0,
      "decimalPlaces": 2
    }
  }
  ```

---

## 8. SettlementStrategy
* **Purpose**: Compute profit/loss based on match outcomes and bet properties.
* **What it owns**: Calculation logic for win, loss, half-win, half-loss, push, and void outcomes.
* **What it must not own**: Score fetching or user database updates.
* **How to extend later**: Dynamic registration of formula strategies per market.
* **Owner decisions required**: Detailed formula definitions (ADR-0028).
* **Example generic shape**:
  ```javascript
  class SettlementStrategy {
    calculate(stake, oddsDecimal, status, outcomes) {
      // Returns { profitLossPoints: Number, state: String }
    }
  }
  ```

---

## 9. ReportAggregator
* **Purpose**: Generate aggregates from historical records.
* **What it owns**: Grouping metrics over day, week, month ranges.
* **What it must not own**: UI styling or persistent storage files.
* **How to extend later**: Add custom charts or custom metrics (e.g. Yield, ROI).
* **Owner decisions required**: Reporting field requirements (ADR-0029).
* **Example generic shape**:
  ```javascript
  class ReportAggregator {
    aggregate(betsList, filterRange) {
      // Returns aggregated reporting structure
    }
  }
  ```

---

## 10. AiRecommendationBoundary
* **Purpose**: Isolate AI suggestions from the journal log and verify inputs.
* **What it owns**: Validation of candidate recommendations, prediction traces, and confidence parameters.
* **What it must not own**: Prediction calculations or auto-staking logic.
* **How to extend later**: Connect new local-ai models.
* **Owner decisions required**: AI recommendations layout and rules (ADR-0030).
* **Example generic shape**:
  ```json
  {
    "candidateId": "rec_112233",
    "predictionTraceId": "pred_xyz987",
    "suggestedMarket": { "type": "1X2", "selection": "home" },
    "suggestedOdds": 0.90,
    "confidenceLabel": "HIGH"
  }
  ```

---

## 11. RiskRuleStrategy
* **Purpose**: Evaluate user actions against safety bounds.
* **What it owns**: Stake caps, warning indicators.
* **What it must not own**: Enforcement locks unless authorized.
* **How to extend later**: Add custom warning modules (e.g., loss streak checks).
* **Owner decisions required**: Warning limits (ADR-0032).
* **Example generic shape**:
  ```javascript
  class RiskRuleStrategy {
    evaluate(candidateBet, userHistory) {
      // Returns list of safety warnings or validation failures
    }
  }
  ```

---

## 12. ResponsibleUseBoundary
* **Purpose**: Enforce safe-use limits (e.g., betting cooldowns, max daily stake limits).
* **What it owns**: Cooldown timers, cumulative daily totals.
* **What it must not own**: User financial details.
* **How to extend later**: Implement hard locks if the owner moves past basic warnings.
* **Owner decisions required**: Threshold guidelines (ADR-0032).
* **Example generic shape**:
  ```javascript
  class ResponsibleUseBoundary {
    isLimitExceeded(dailyTotalPoints, limitThreshold) {
      return dailyTotalPoints > limitThreshold;
    }
  }
  ```
