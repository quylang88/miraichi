# ADR-0016: Ingestion Quality, Freshness, and Traceability Boundary

* **Status**: Accepted
* **Date**: 2026-06-23
* **Accepted Date**: 2026-06-23
* **Owner Approval**: Approved by project owner
* **Implementation Status**: Not started
* **Note**: This ADR guides Phase 3 mock ingestion planning and does not authorize production ingestion, database integration, provider integration, prediction logic, or betting logic.

---

## 1. Context
Corrupted or stale odds feeds can lead to bad prediction outputs, which compromises system integrity. We must validate ingested feeds and audit the data state that triggered any given prediction.

## 2. Options Considered
* **Option A**: Process all incoming feed records as-is and delegate validations to the prediction engine.
* **Option B (Recommended)**: Enforce validation checks at the ingestion parser boundary and stamp metadata (timestamp, provider source) onto all normalized objects.
* **Option C**: Set up a secondary offline data validation and reconciliation process.

## 3. Decision & Recommendation
Recommend **Option B**. The ingestion parser filters out invalid records (e.g., negative scores, zero odds, matches outside configured competition or season windows) before normalization. Stamped metadata fields (`ingestedAt`, `sourceProviderId`) are appended for audit tracking.

## 4. Consequences
* Prevents malformed odds or negative match scores from reaching downstream mock repositories, API consumers, and future local AI input candidates.
* Simplifies auditing by keeping a clear trail of ingestion time and origin provider.
* Increases memory utilization slightly to track metadata.

## 5. Risks
* Excessively strict validation thresholds might reject valid market outliers (e.g., very high underdog odds).

## 6. Open Questions
* What is the threshold for deciding a fixture or odds line is "stale" and should be ignored?
* How do we handle partial feed failures (e.g., fixture metadata is correct, but odds feed fails)?

## 7. Explicit Exclusions
* This decision does NOT select production logging stacks (e.g. Sentry, Datadog), exception trackers, or audit retention database engines.
