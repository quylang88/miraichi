# ADR-0038: Prediction Evaluation Criteria and Metrics

* **Status**: Draft - Owner Review Required
* **Date**: 2026-06-28
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started
* **Source Candidate**: [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md)
* **Note**: This draft defines evaluation metric categories only. Thresholds and promotion gates belong in ADR-0040.

---

## 1. Context
Outcome accuracy alone is not enough for probabilistic football predictions. A model can pick winners poorly calibrated or overconfident, which makes downstream explanation and risk decisions unsafe.

## 2. Options Considered
* **Option A**: Evaluate predictions only by win/draw/loss accuracy.
* **Option B (Draft Recommended)**: Evaluate probabilistic forecasts using Brier Score and Expected Calibration Error, compared with a bookmaker-implied baseline.

## 3. Draft Recommendation
Recommend **Option B**.

Use Brier Score to measure probability error and Expected Calibration Error to measure whether predicted confidence matches observed frequency. Compare model outputs with a bookmaker-implied probability baseline where odds are available.

This ADR should not set final pass/fail thresholds. Thresholds, sample-size gates, and promotion authority belong in ADR-0040.

## 4. Owner Decisions Required
| Question | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| Should recent matches be weighted higher in calibration? | Not for the primary acceptance metric. Keep primary evaluation chronological and unweighted; report recent-weighted diagnostics separately. | Weighted metrics can hide long-term calibration failures. | A model may look better on recent slices while failing stable out-of-sample behavior. |
| What minimum sample size is needed for ECE confidence? | Treat 100 matches as a weak candidate minimum for review, not strong statistical proof. Require reporting bin counts and confidence notes. | ECE is unstable with small samples and sparse bins. | Accepting ECE without sample context creates false confidence in the model. |

## 5. Consequences
* Evaluation focuses on probability quality, not just picked outcomes.
* The system can compare against market-derived baselines.
* Model readiness remains separate from betting profitability and bankroll logic.

## 6. Risks
* Simple proportional odds normalization may not perfectly remove bookmaker margin.
* ECE can be sensitive to binning choices and sample size.
* World Cup-only samples are too small for strong confidence by themselves.

## 7. Explicit Exclusions
* No final model acceptance threshold is approved.
* No betting ROI, CLV, bankroll, stake sizing, or Kelly Criterion logic is approved.
* No model algorithm or training method is approved.
* No production promotion workflow is approved.

## 8. Draft Readiness
This ADR is ready to become a draft if it stays limited to metric categories and leaves gates to ADR-0040.
