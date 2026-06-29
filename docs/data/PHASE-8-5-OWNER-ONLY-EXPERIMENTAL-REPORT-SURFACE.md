# Phase 8.5 Owner-Only Experimental Report Surface

## Status
- **Audience**: owner-only
- **Label**: Experimental, not production ready.
- **Source report**: `phase-8-4-candidate-model-bakeoff`
- **Selected candidate**: null
- **Selection authority**: `blocked_until_phase_8_6_model_selection_adr`

## Dataset Evidence
- Dataset: `dataset-national-team-aggregate-comp-int-world-cup__comp-int-euro`
- Competitions: `comp-int-world-cup`, `comp-int-euro`
- Feature spec version: `feature-spec-v0.1.0`
- Test sample count: 214
- Bookmaker baseline available: no

## Candidate Evidence
- Rank 1: `elo_rating_v0` (elo_rating) - LogLoss=1.004647, Brier=0.600486, Accuracy=0.565421, ECE=0.091350, N=214
- Rank 2: `multinomial_logistic_competition_v0` (multinomial_logistic_regression) - LogLoss=1.052865, Brier=0.637552, Accuracy=0.429907, ECE=0.009309, N=214

## Known Weaknesses
- Bookmaker baseline is unavailable for the current dataset; candidate results cannot be judged against market-implied probabilities.

## Explicit Non-Authorizations
- No public prediction surface.
- No `engineMode: production`.
- No model selected.
- No betting recommendation.
- No stake sizing, Kelly, bankroll, ROI, or CLV.
- No club competition expansion.

## Next Allowed Phase
`phase:plan Phase 8.6 Model Selection ADR`
