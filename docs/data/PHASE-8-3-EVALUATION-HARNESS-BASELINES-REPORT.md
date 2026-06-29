# Phase 8.3 Evaluation Harness and Baselines Report

## Status
- **Status**: Completed
- **Date**: 2026-06-28
- **Scope**: Owner-only World Cup/national-team-first evaluation harness and baseline report.

## Direct Conclusion
Phase 8.3 can generate aggregate national-team baseline metrics across provider-confirmed competitions; this is still owner-only R&D evidence, not model-selection approval.

## Evidence
- Dataset: `dataset-national-team-aggregate-comp-int-world-cup__comp-int-euro`
- Competition: `aggregate-national-team`
- Competitions: `comp-int-world-cup`, `comp-int-euro`
- Feature spec version: `feature-spec-v0.1.0`
- Evaluation split: `test`
- Test sample count: 214
- Missing bookmaker baseline count: 214
- Metrics implementation: pure TypeScript in `apps/local-ai`

## Baselines
- `uniform_1x2`: Brier=0.666667, LogLoss=1.098612, Accuracy=0.425234, ECE=0.091900, N=214
- `train_outcome_frequency_smoothed`: Brier=0.635881, LogLoss=1.048170, Accuracy=0.425234, ECE=0.003857, N=214

## Warnings


## Explicit Non-Authorizations
- No model training.
- No candidate model selection.
- No runtime prediction route.
- No betting recommendation, stake sizing, Kelly, bankroll, ROI, or CLV logic.
- No club competition expansion.

## Recommendation
Phase 8.4 may proceed only as a gated candidate model bake-off plan; do not treat baseline or candidate results as model-selection approval without the later ADR.

## Verification
- `pnpm --filter local-ai test`: Run separately
- `pnpm run phase8:evaluation-harness`: PASS
- `pnpm run verify:local`: Required external verification
- `pnpm run test:integration`: Required external verification
