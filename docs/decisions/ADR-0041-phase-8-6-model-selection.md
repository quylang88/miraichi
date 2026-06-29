# ADR-0041: Phase 8.6 Model Selection Decision

* **Status**: Proposed
* **Date**: 2026-06-29
* **Owner Approval Required**: Yes
* **Owner Approval**: Pending
* **Implementation Status**: Not started
* **Phase**: 8.6 Model Selection ADR
* **Source Evidence**:
  * [Phase 8.2 Feature Spec and Leakage Audit Report](file:///c:/CODE/miraichi/docs/data/PHASE-8-2-FEATURE-SPEC-LEAKAGE-AUDIT-REPORT.md)
  * [Phase 8.3 Evaluation Harness and Baselines Report](file:///c:/CODE/miraichi/docs/data/PHASE-8-3-EVALUATION-HARNESS-BASELINES-REPORT.md)
  * [Phase 8.3A National-Team Dataset Expansion Report](file:///c:/CODE/miraichi/docs/data/PHASE-8-3A-NATIONAL-TEAM-DATASET-EXPANSION-REPORT.md)
  * [Phase 8.4 Candidate Model Bake-Off Report](file:///c:/CODE/miraichi/docs/data/PHASE-8-4-CANDIDATE-MODEL-BAKEOFF-REPORT.md)
  * [Phase 8.5 Owner-Only Experimental Report Surface](file:///c:/CODE/miraichi/docs/data/PHASE-8-5-OWNER-ONLY-EXPERIMENTAL-REPORT-SURFACE.md)

---

## 1. Context

Phase 8 has produced an owner-only national-team-first R&D evidence chain:

1. Dataset provenance and feature leakage boundaries exist.
2. Chronological evaluation and baseline reports exist.
3. Candidate model bake-off exists for the aggregate World Cup + Euro national-team dataset.
4. Owner-only experimental report surface exists.

The current scored out-of-sample test count is 107. The bookmaker baseline is unavailable in the current dataset, so the candidates cannot be judged against market-implied probabilities.

The Phase 8.4 ranking currently places:

| Rank | Candidate | Log Loss | Brier | Accuracy | ECE | Test N |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `elo_rating_v0` | 1.048001 | 0.628985 | 0.514019 | 0.044913 | 107 |
| 2 | `multinomial_logistic_competition_v0` | 1.056838 | 0.639697 | 0.448598 | 0.004435 | 107 |

The best simple baseline from Phase 8.4 evidence has log loss 1.066064 and Brier score 0.644524. `elo_rating_v0` improves on those simple baseline values in the current report, but the evidence remains high variance and lacks bookmaker comparison.

## 2. Decision

**Recommended decision: select no model for activation in Phase 8.6.**

No candidate should be promoted to a runtime prediction engine, model artifact, production mode, or recommendation surface from the current evidence.

The candidate ranking may remain available as owner-only R&D evidence. It does not authorize:

- public prediction surfaces;
- `engineMode: production`;
- betting recommendations;
- stake sizing, Kelly, bankroll, ROI, or CLV logic;
- club competition expansion;
- ONNX/runtime packaging;
- model artifact promotion.

## 3. Why

The evidence is useful but not strong enough for model selection:

- **Sample size is weak**: 107 test fixtures is enough for R&D inspection but not stable model-selection confidence.
- **Bookmaker baseline is missing**: without market-implied probabilities, we cannot prove practical value against the strongest relevant baseline.
- **Candidate margin is small**: Elo beats the simple baseline in the current report, but the margin is not enough to justify activation without stronger data.
- **Scope remains national-team-first**: club competitions remain blocked until the national-team path is reviewed and explicitly expanded.
- **ADR-0040 says gates are non-blocking report metrics**: current reports support manual review, not auto-promotion.

## 4. Options Considered

### Option A: Select `elo_rating_v0` for owner-only inference

Rejected for now.

`elo_rating_v0` ranks first in the current bake-off and is transparent, but the dataset is still small and missing bookmaker baseline comparison. Selecting it now would create false confidence.

### Option B: Select `multinomial_logistic_competition_v0`

Rejected.

The logistic candidate is traceable and calibrated on the current evidence, but it is weaker than Elo on log loss, Brier score, and accuracy in the current bake-off.

### Option C: Select no model and continue R&D

Recommended.

This preserves evidence value without crossing into runtime/model-promotion risk.

### Option D: Skip to runtime packaging anyway

Rejected.

Runtime packaging before a selected model would violate Phase 8 boundaries and create technical work around an unapproved model.

## 5. Consequences

- Phase 8.6 can close with no model selected.
- Phase 8.7 runtime packaging remains blocked.
- Candidate evidence remains useful for owner-only R&D reports.
- Future model selection should require stronger evidence, preferably:
  - more national-team competitions or larger national-team historical coverage;
  - bookmaker baseline availability;
  - repeated chronological validation;
  - calibration review on a larger sample.

## 6. Owner Decisions Required

| Question | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| Should Phase 8.6 select a model now? | **No. Select no model.** | Current evidence is high variance and lacks bookmaker baseline comparison. | Selecting now creates false confidence and could pressure runtime work too early. |
| Should Phase 8.7 runtime packaging start now? | **No. Keep Phase 8.7 blocked.** | Runtime packaging needs an approved selected model first. | Packaging an unselected model wastes effort and weakens governance. |
| Should candidate reports remain available? | **Yes, owner-only and experimental.** | They are useful R&D evidence when clearly labeled. | Removing them hides evidence; making them product-facing overstates readiness. |
| What should happen next? | Plan more evidence before reconsidering selection. | Better data and bookmaker comparison are the real bottlenecks. | More model complexity without better evidence will look productive but not improve trust. |

## 7. Explicit Non-Authorizations

- No model is selected by this proposed ADR until owner approval.
- No runtime prediction route is approved.
- No public prediction surface is approved.
- No `engineMode: production` is approved.
- No model artifact promotion is approved.
- No ONNX/runtime packaging is approved.
- No betting recommendation is approved.
- No stake sizing, Kelly, bankroll, ROI, or CLV logic is approved.
- No club competition expansion is approved.

## 8. Acceptance Criteria

This ADR may be accepted only if the owner explicitly agrees that:

1. no model is selected in Phase 8.6;
2. Phase 8.7 runtime packaging remains blocked;
3. owner-only experimental reports can remain available as R&D evidence;
4. future selection requires stronger evidence before activation.
