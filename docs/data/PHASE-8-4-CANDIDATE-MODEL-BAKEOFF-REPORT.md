# Phase 8.4 Candidate Model Bake-Off Report

## Status
- **Status**: Completed
- **Report ID**: `phase-8-4-candidate-model-bakeoff`
- **Phase**: `8.4`

## Direct Conclusion
No model is selected in Phase 8.4. Phase 8.4 only ranks candidates and does not authorize runtime or betting use.
- No runtime prediction route.
- No betting recommendation.
- No stake sizing, Kelly, bankroll, ROI, or CLV.
- No club expansion.

## Evidence
- Dataset: `dataset-national-team-aggregate-comp-int-world-cup__comp-int-euro`
- Competitions: `comp-int-world-cup`, `comp-int-euro`
- Feature spec version: `feature-spec-v0.1.0`
- Sample count: 214
- Baseline log loss: 1.048
- Baseline Brier score: 0.636
- Bookmaker baseline available: no

## Candidates
- 1. `elo_rating_v0` (elo_rating) - LogLoss=1.005, Brier=0.600, Accuracy=0.565, N=214
- 2. `multinomial_logistic_competition_v0` (multinomial_logistic_regression) - LogLoss=1.053, Brier=0.638, Accuracy=0.430, N=214

## Ranking
- Ranked candidate IDs: `elo_rating_v0`, `multinomial_logistic_competition_v0`
- Selected candidate ID: null
- Selection authority: `blocked_until_phase_8_6_model_selection_adr`

## Warnings
- Bookmaker baseline is unavailable for the current dataset; candidate results cannot be judged against market-implied probabilities.

## Explicit Non-Authorizations
- No model is selected in Phase 8.4.
- No runtime prediction route.
- No betting recommendation.
- No stake sizing, Kelly, bankroll, ROI, or CLV.
- No club competition expansion.
- No model selection until Phase 8.6 Model Selection ADR.

## Next Phase
Phase 8.5 Owner-Only Experimental Report Surface, before any Phase 8.6 Model Selection ADR.
