# ADR-0040: Model-Readiness Gates and Deployment Governance

* **Status**: Draft - Owner Review Required
* **Date**: 2026-06-28
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started
* **Source Candidate**: [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md)
* **Note**: This draft proposes candidate gates for R&D and staging eligibility only. It does not approve production promotion or betting advice.

---

## 1. Context
A model that is overfit, uncalibrated, or weaker than the market baseline should not be surfaced as ready for recommendation usage. Automated gates are useful, but they cannot replace owner approval.

## 2. Options Considered
* **Option A**: Rely on manual code reviews and developer judgment to promote model files.
* **Option B (Draft Recommended)**: Require automated model-readiness gates plus explicit owner approval before promotion.

## 3. Draft Recommendation
Recommend **Option B** with candidate R&D/staging gates:

1. **Brier Improvement Gate**: Candidate model Brier Score should be at least 1% lower than the bookmaker-implied baseline on the out-of-sample set.
2. **Data Sufficiency Gate**: Candidate model should be evaluated on at least 100 out-of-sample fixtures.
3. **Calibration Gate**: Candidate model Expected Calibration Error should be under 5%.
4. **Owner Approval Gate**: Passing automated gates makes a model eligible for owner review only. It does not auto-promote the model.

These values are draft thresholds, not accepted production thresholds.

## 4. Owner Decisions Required
| Question | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| Who approves model promotion if gates pass? | The project owner gives final approval. Automated gates are necessary but not sufficient. | Model output affects product trust and future betting-adjacent workflows. | Auto-promotion can surface weak or misleading recommendations. |
| Should calibration gates be separate per market type? | Yes. Start with `1X2`; add Over/Under and other markets only after enough market-specific data exists. | Different markets have different distributions and liquidity. | A model can pass on one market while failing another. |
| Should 1% Brier improvement, 100 fixtures, and ECE < 5% be accepted now? | Keep them as draft-only R&D/staging candidate gates until Phase 8 produces empirical evidence. | These thresholds are plausible but not yet validated on Miraichi data. | Premature production thresholds create false certainty and may block useful research or approve weak models. |

## 5. Consequences
* Model promotion becomes evidence-driven.
* Passing gates creates a review checkpoint, not automatic deployment.
* Betting profitability remains explicitly outside model-readiness gates.

## 6. Risks
* The candidate thresholds may be too strict or too weak once real data is available.
* The World Cup alone may not provide enough samples for stable calibration.
* Brier improvement over bookmaker baselines may be hard to achieve consistently.

## 7. Explicit Exclusions
* No production model hosting platform is approved.
* No deployment pipeline, container image, or CI/CD model job is approved.
* No betting recommendation, stake sizing, bankroll rule, ROI, CLV, or Kelly Criterion logic is approved.
* No model algorithm, feature formula, or training implementation is approved.
* No production promotion is approved.

## 8. Draft Readiness
This ADR can become a draft, but it should not be accepted as production governance until owner approval and Phase 8 evidence exist.
