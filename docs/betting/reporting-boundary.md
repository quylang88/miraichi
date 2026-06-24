# Reporting Boundary Specification

This document defines the owner-applied candidate metrics and structure of the betting reports within Miraichi.

## 1. Time-Based Reports

To give users clear insights into their wagers, the system groups reporting data into three owner-approved v1 intervals:
* **Daily Report**: Wagers in a browser-local report period.
* **Weekly Report**: Aggregated metrics in a browser-local weekly period.
* **Monthly Report**: Monthly aggregate performance view in a browser-local period.

Stored event timestamps remain UTC. Report grouping uses the browser local timezone.

---

## 2. Candidate Report Fields

These fields are proposed for the report object. They are candidate metrics and do not represent a final database view:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `totalBets` | Integer | Total number of bet records in the period. |
| `settledBets` | Integer | Number of wagers that have been resolved. |
| `pendingBets` | Integer | Number of wagers awaiting settlement. |
| `winCount` | Integer | Count of wagers settled as "won" or "half_won". |
| `lossCount` | Integer | Count of wagers settled as "lost" or "half_lost". |
| `pushCount` | Integer | Count of wagers settled as "push". |
| `voidCount` | Integer | Count of wagers settled as "void". |
| `halfWinCount` | Integer | Count of wagers settled as "half_won". |
| `halfLossCount` | Integer | Count of wagers settled as "half_lost". |
| `totalStakePoints` | Number | Total stake points in the report period. |
| `profitLossPoints` | Number | Signed net profit or loss points accumulated from approved values. |
| `marketBreakdown` | Map | Map of market types to their respective volumes and approved point totals. |
| `liveVsPreMatchBreakdown` | Map | Breakdown of pre-match vs. live wager counts and approved point totals. |

Deferred fields and calculations:

* ROI
* Yield
* CLV
* Bankroll curve
* Advanced charts

---

## 3. Replaceable Aggregator Module

To satisfy the isolation principles in `docs/governance/OWNER-DECISION-GATES.md`:
* **No Aggregation Code**: Do not write any SQLite group-by queries, reduce methods, or database view scripts in v1.
* **Aggregator Boundary**: `ReportAggregator` remains a documentation-level boundary for future implementation planning. It must not implement formulas, database queries, persistent report views, ROI/yield/CLV, or bankroll curve logic until approved.
