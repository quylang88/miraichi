# Stake Points and Profit/Loss Boundary

This document outlines the owner-applied candidate guidelines and constraints for points-based wagers in the betting journal.

## 1. Stake and Profit/Loss Units (v1)

To protect users and keep the initial version simple, all wagers are tracked using points:
* **Stake v1**: Expressed in points (`stakePoints`). It must be a positive number, may use decimals up to 2 decimal places, and must be greater than 0.
* **Profit/Loss v1**: Expressed in points (`profitLossPoints`). It must be a signed number, can be positive, zero, or negative, and remains nullable while a bet is pending.
* **Calculation Boundary**: Profit/loss formulas are deferred. Auto-calculation may be planned later only after settlement formulas are owner-approved.

---

## 2. Owner-Applied Decisions

The following owner decisions apply to Phase 5 candidate wording:

### Q1: Can stakes support decimal inputs?
* **Owner decision**: Yes. Decimals are allowed up to 2 decimal places.

### Q2: Can stakes be negative?
* **Owner decision**: No. `stakePoints` must be greater than 0.

### Q3: Should stake sizing or bankroll rules be implemented now?
* **Owner decision**: No. ROI, yield, stake-sizing, Kelly Criterion, bankroll adjustment, and risk formulas are deferred.

### Q4: How should pending profit/loss be represented?
* **Owner decision**: `profitLossPoints` is nullable while the bet is pending.

### Q5: How are half-win and half-loss payouts computed for quarter lines?
* **Owner decision**: Settlement formulas are deferred until explicit owner approval. Half-win and half-loss remain lifecycle states, not approved formulas.

### Q6: Should cashout be supported in v1?
* **Owner decision**: Use `manual_adjustment` for cashout, operator-specific settlement, unusual cases, and manual correction. Do not implement cashout formulas.

---

## 3. Implementation Guardrails

* **No Hardcoded Formulas**: Do not write functions or equations in code files that calculate profit/loss.
* **Replaceable Strategy**: All calculations must reside within a `SettlementStrategy` adapter that can be replaced or updated if the owner decides on new calculation models.
* **Hybrid Future Direction**: Auto-calculate profit/loss later only after settlement formulas are owner-approved; allow manual override/manual adjustment for edge cases.
