# Phase 8.3 Evaluation Harness and Baselines Report

## Status
- **Status**: Completed
- **Date**: 2026-06-28
- **Scope**: Owner-only World Cup/national-team-first evaluation harness and baseline report.

## Direct Conclusion
Phase 8.3 can generate baseline metrics, but the current World Cup-only snapshot is too small for model-readiness or calibration confidence.

## Evidence
- Dataset: `dataset-comp-int-world-cup-2026-06-28`
- Competition: `comp-int-world-cup`
- Feature spec version: `feature-spec-v0.1.0`
- Evaluation split: `test`
- Test sample count: 107
- Missing bookmaker baseline count: 107
- Metrics implementation: pure TypeScript in `apps/local-ai`

## Baselines
- `uniform_1x2`: Brier=0.666667, LogLoss=1.098612, Accuracy=0.448598, ECE=0.115265, N=107
- `train_outcome_frequency_smoothed`: Brier=0.644524, LogLoss=1.066064, Accuracy=0.448598, ECE=0.007157, N=107

## Warnings
- World Cup-only evaluation must not be treated as statistically strong until related national-team competitions are added.

## Explicit Non-Authorizations
- No model training.
- No candidate model selection.
- No runtime prediction route.
- No betting recommendation, stake sizing, Kelly, bankroll, ROI, or CLV logic.
- No club competition expansion.

## Recommendation
Do not start Phase 8.4 candidate model bake-off until related national-team competitions are added or the owner accepts that Phase 8.4 will run as a high-variance experiment only.

## Verification
- `pnpm --filter local-ai test`: Run separately
- `pnpm run phase8:evaluation-harness`: PASS
- `pnpm run verify:local`: Required external verification
- `pnpm run test:integration`: Required external verification
