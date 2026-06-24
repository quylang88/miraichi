# Reporting Boundary Specification

This document defines the metrics and structure of the betting reports within Miraichi.

## 1. Time-Based Reports

To give users clear insights into their wagers, the system groups reporting data into three main intervals:
* **Daily Report**: Wagers settled within a specific 24-hour window (based on user local timezone).
* **Weekly Report**: Aggregated metrics from Monday to Sunday.
* **Monthly Report**: Monthly aggregate performance view.

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
| `profitLossPoints`| Number | Net profit or loss points accumulated. |
| `averageStakePoints`| Number | Mean stake points per wager. |
| `marketBreakdown`| Map | Map of market types to their respective volumes and net profit (e.g. `{"1X2": { count: 3, profit: 5.5 }}`). |
| `liveVsPreMatchBreakdown`| Map | Breakdown of performance for pre-match vs. live wagers. |

---

## 3. Replaceable Aggregator Module

To satisfy the isolation principles in `docs/governance/OWNER-DECISION-GATES.md`:
* **No Aggregation Code**: Do not write any SQLite group-by queries, reduce methods, or database view scripts in v1.
* **Aggregator Interface**: The interface to calculate reports must be defined as a standalone module `ReportAggregator`. This module takes a raw list of resolved `BetRecordEnvelope` objects and produces the report structure. This ensures that how we calculate metrics can be updated or swapped (e.g., shifting calculations from local Javascript memory to a SQL backend) without altering the frontend views.

```typescript
interface IReportAggregator {
  /**
   * Aggregates a list of wagers into a structured period report.
   */
  generateReport(wagers: BetRecordEnvelope[], startDate: Date, endDate: Date): CandidatePeriodReport;
}
```
