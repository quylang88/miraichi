# Bankroll Management Strategy

Current boundary for the owner-approved single-bankroll warning flow.

## Purpose
Documents future warning-only bankroll concepts. It does not approve stake sizing, Kelly Criterion, bankroll growth formulas, or risk formulas.

## Status
- **Status**: Active under ADR-0050

## Scope
Plans a replaceable warning boundary only. No calculator or recommended stake logic is approved.

## Strategy Guidelines
- V1 direction is warning-only.
- Users should be able to override warnings.
- No default numeric threshold is approved.
- No Kelly Criterion, stake-sizing helper, bankroll growth formula, or max drawdown formula is approved.
- Approved warning categories are owner-configured big-bet, daily loss, weekly loss, candidate overexposure, and risky self-reported motivation (`chasing_loss`, `fomo`, `impulse`).
- Warnings remain overridable after the persistent acknowledgement boundary.
- Emotion labels are descriptive and do not infer composure or trigger a hard rule by themselves.

## TODO / Next Steps
- [x] ADR-0050 explicitly approves the single-bankroll warning boundary without stake sizing or profit formulas.
- [ ] Keep multi-account, loss-streak formulas, percentage-of-bankroll limits, and automated stake sizing out of V1 unless a later owner-approved ADR reopens them.
