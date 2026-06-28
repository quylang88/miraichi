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
- Test sample count: 1
- Missing bookmaker baseline count: 1
- Metrics implementation: pure TypeScript in `apps/local-ai`

## Baselines
- `uniform_1x2`: Brier=0.666667, LogLoss=1.098612, Accuracy=1.000000, ECE=0.666667, N=1
- `train_outcome_frequency_smoothed`: Brier=0.375000, LogLoss=0.693147, Accuracy=1.000000, ECE=0.500000, N=1

## Warnings
- Evaluation sample count is below 100 fixtures; this is harness/plumbing evidence only, not reliable calibration evidence.
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
