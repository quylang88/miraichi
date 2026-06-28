# ADR-0040: Model-Readiness Gates and Deployment Governance

* **Status**: Draft - Owner Review Required
* **Date**: 2026-06-28
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started
* **Source Candidate**: [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md)
* **Note**: This draft proposes candidate gates for R&D and owner-only experimental review only. It does not approve production promotion, public recommendations, or betting advice.

---

## 1. Context
A model that is overfit, uncalibrated, or weaker than the market baseline should not be surfaced as ready for recommendation usage. Automated gates are useful, but they cannot replace owner approval.

## 2. Options Considered
* **Option A**: Rely on manual code reviews and developer judgment to promote model files.
* **Option B (Draft Recommended)**: Require automated model-readiness gates plus explicit owner approval before promotion.

## 3. Draft Recommendation
Recommend **Option B** with candidate owner-only R&D review gates, implemented as **non-blocking metrics in experimental reports**:

1. **Brier Improvement Gate**: Candidate model Brier Score should be compared against the bookmaker-implied baseline on the out-of-sample set (target: at least 1% improvement).
2. **Data Sufficiency Gate**: Candidate model should be evaluated on at least 100 out-of-sample fixtures to ensure statistical relevance.
3. **Calibration Gate**: Candidate model Expected Calibration Error should be calculated (target: under 5%).
4. **Owner Manual Sign-off**: The automated gates serve as visual health indicators on a model comparison report. The owner manually decides which model version to activate based on report evidence.

These values are draft guidelines, not strict automated blocking checks. For this first owner-only phase, the local-ai pipeline should output these metrics in an experimental evaluation log/report. It should not fail builds, block deployments, or automatically restrict model experimentation. It must not present a model as production-ready, recommend wagers, suggest stakes, or expose prediction recommendations to public users.

## 4. Owner Decisions Required
| Question | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| Should gates block local model execution/usage? | **No, they should be non-blocking report metrics.** They act as indicators on an experimental report rather than hard blockers. | Hard-blocking gates during initial R&D will prevent the owner from testing models or diagnosing performance issues. | Strict gates will block developer/owner iteration before we have baseline empirical datasets. |
| Who approves model promotion if gates pass? | The project owner gives final manual approval based on the generated evaluation reports. | Model output affects product trust and future betting-adjacent workflows. | Auto-promotion can surface weak or misleading recommendations. |
| Should calibration gates be separate per market type? | Yes. Start with `1X2`; add Over/Under and other markets only after enough market-specific data exists. | Different markets have different distributions and liquidity. | A model can pass on one market while failing another. |
| Should 1% Brier improvement, 100 fixtures, and ECE < 5% be accepted now? | Keep them as draft-only R&D/staging candidate gates until Phase 8 produces empirical evidence. | These thresholds are plausible but not yet validated on Miraichi data. | Premature production thresholds create false certainty and may block useful research or approve weak models. |
| What should owner-only usage allow before production governance is accepted? | Allow private experimental reports for the project owner only. Do not allow public predictions, model-ready labels, betting recommendations, or stake advice. | Owner-only reports support learning without creating product trust or responsible-use exposure. | Treating private experiments as recommendations will blur the safety boundary and invite bad decisions from weak evidence. |

## 5. Consequences
* Model promotion becomes evidence-driven.
* Passing gates creates a review checkpoint, not automatic deployment.
* Betting profitability remains explicitly outside model-readiness gates.
* Owner-only experiments can proceed later only as reports, not production recommendations.

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
* No public prediction surface, model-ready badge, or automated recommendation workflow is approved.

## 8. Draft Readiness
This ADR remains draft. It should be reviewed again after Phase 8 produces empirical evaluation evidence. For now, the safest recommendation is to keep the candidate gates as owner-only R&D report gates, not production acceptance gates.
