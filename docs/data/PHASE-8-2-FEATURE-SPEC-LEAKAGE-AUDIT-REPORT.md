# Phase 8.2 Feature Spec and Leakage Audit Report

## Status
- **Status**: Completed
- **Date**: 2026-06-28
- **Scope**: World Cup and national-team-first feature specification and leakage audit.

## Direct Conclusion
Phase 8.2 defines the feature specification and leakage audit boundary only.

It does not authorize model training, feature value generation, runtime prediction, betting recommendations, stake sizing, or club competition expansion.

## Evidence
- Feature spec version: `feature-spec-v0.1.0`
- Initial competition scope: `world-cup-national-team-first`
- Dataset target: `comp-int-world-cup`
- Leakage audit report: `apps/local-ai/reports/phase-8-2-feature-leakage-audit.json`

## Approved Feature Families
- Rolling form from prior matches only.
- Rest and schedule context available before kickoff only.
- Versioned pre-match rating snapshots only.
- Pre-match market baseline inputs where odds exist before kickoff.

## Blocked Leakage Inputs
- Target-match full-time goals.
- Result labels and outcome labels.
- Post-match odds movement.
- Betting ROI, CLV, stake sizing, Kelly, bankroll, and profit/loss fields.
- Team, tournament, league, or club shortcuts.

## Known Weaknesses
- The Phase 8.1 sample dataset is too small for model training or calibration claims.
- World Cup-only data will remain high variance until related national-team competitions are added through owner-approved source scope.
- Feature values are not generated in Phase 8.2; that remains future work after this leakage boundary is accepted.

## Recommendation
The earliest safe next lifecycle command after Phase 8.2 passes is:

```bash
phase:implementation-plan Phase 8.3 Evaluation Harness and Baselines
```

Phase 8.3 must build baselines and metric reporting before any candidate model bake-off starts.
