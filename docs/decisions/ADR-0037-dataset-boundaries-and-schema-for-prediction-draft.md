# ADR-0037: Dataset Boundaries and Schema for Prediction

* **Status**: Draft - Owner Review Required
* **Date**: 2026-06-28
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started
* **Source Candidate**: [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md)
* **Note**: This draft defines dataset boundaries only. It does not approve feature formulas, model training code, or production storage.

---

## 1. Context
Future prediction R&D needs reproducible datasets built from fixtures, results, statistics, lineups, and odds. The dataset boundary must prevent data leakage and isolate model R&D from operational storage changes.

## 2. Options Considered
* **Option A**: Train models by querying raw operational database records at runtime.
* **Option B (Draft Recommended)**: Build static, versioned offline datasets from raw provider snapshots and normalized records.

## 3. Draft Recommendation
Recommend **Option B**.

Store raw provider responses separately from normalized records and derived feature datasets. Dataset builds should be reproducible from source snapshots, schema versions, and feature-spec versions.

Initial dataset artifacts should prefer JSON Lines for machine processing and optional CSV exports for manual inspection. Binary formats and embedded databases should remain future scale options, not first-draft requirements.

## 4. Owner Decisions Required
| Question | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| Should Miraichi adopt Parquet or SQLite now? | No for v1. Use JSONL plus optional CSV. Revisit Parquet or SQLite only when dataset size or query latency proves it is needed. | JSONL is simple, diffable enough for samples, and easy for TypeScript/Python tooling. | Premature binary or DB formats add tooling and migration cost before the dataset shape is stable. |
| What versioning scheme should datasets use? | Use `datasetId`, `schemaVersion`, `featureSpecVersion`, `sourceProviderId`, `sourceSnapshotHash`, `builtAt`, and split metadata. | Date folders alone do not prove reproducibility. | Without version metadata, model results cannot be traced back to exact source data and feature definitions. |

## 5. Consequences
* Dataset generation can be rerun and audited.
* Model R&D can use stable snapshots instead of live provider calls.
* Operational storage remains decoupled from training experiments.

## 6. Risks
* Static datasets may grow quickly.
* Feature definitions can drift unless feature-spec versions are recorded.
* Dataset artifacts may accidentally include data from after the prediction cutoff if split rules are weak.

## 7. Explicit Exclusions
* No final feature list is approved.
* No rolling-stat, head-to-head, rating, or probability formula is approved.
* No cloud dataset storage provider is approved.
* No production database schema is approved.
* No model training implementation is approved.

## 8. Draft Readiness
This ADR is ready to become a draft. It defines a boundary and defers the high-risk mathematical decisions correctly.
