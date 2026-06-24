# Stake Points and Profit/Loss Boundary

This document outlines the guidelines and constraints for points-based wagers in the betting journal.

## 1. Stake and Profit/Loss Units (v1)

To protect users and keep the initial version simple, all wagers are tracked using points:
* **Stake v1**: Expressed in points (`stakePoints`). Users input how many points they want to risk on a match.
* **Profit/Loss v1**: Calculated and stored in points (`profitLossPoints`).
* **Calculation Boundary**: When a bet status changes from pending to settled, the system computes the profit/loss points using the stake and the normalized odds value.

---

## 2. Staking Open Questions

The following topics remain open for owner decision before calculations are implemented:

### Q1: Can stakes support decimal inputs?
* **Recommended Default**: Yes, support fractional points with up to two decimal places (e.g. `2.50` points) to allow users to apply precise staking formulas.
* **Alternative**: Integer-only wagers.

### Q2: Can stakes be negative?
* **Recommended Default**: No, stakes must be strictly positive (> 0). Negative wagers or lay staking structures are out-of-scope for the basic journal.

### Q3: What is the maximum allowed stake?
* **Recommended Default**: Set a soft warning limit at `1000` points per wager, but allow the user to override it.

### Q4: How is a void bet resolved?
* **Recommended Default**: Net profit/loss = `0` points, and the full stake is returned (implied).

### Q5: How are half-win and half-loss payouts computed for quarter lines?
* **Recommended Default**:
  * **Half-Win**: Returns half the win profit + full stake return.
    `Profit/Loss = Stake * (OddsDecimal - 1) / 2`
  * **Half-Loss**: Returns half the stake (net loss of half the stake).
    `Profit/Loss = -Stake / 2`
* **Alternative**: Treat all split results as custom manual entry fields.

### Q6: Should cashout be supported in v1?
* **Recommended Default**: No cashout calculations. If a user cashes out a real bet early, they can manually enter their custom profit/loss by marking the status as settled and choosing "manual adjustment".

---

## 3. Implementation Guardrails

* **No Hardcoded Formulas**: Do not write functions or equations in code files that calculate profit/loss.
* **Replaceable Strategy**: All calculations must reside within a `SettlementStrategy` adapter that can be replaced or updated if the owner decides on new calculation models.
