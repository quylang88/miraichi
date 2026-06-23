# Data Quality Rules

Validations and integrity rules for sports data fields.

## Purpose
Prevents incorrect match results or bad odds formats from corrupting prediction models.

## Status
- **Status**: Draft / Active Planning

## Scope
Validation thresholds for teams, matches, scores, and odds.

## Quality Rules
- Odds values must be positive and non-zero.
- Fixture dates must reside within acceptable league season boundaries.
- Match score integers must not be negative.

## TODO / Next Steps
- [ ] Implement in-memory validation rules within parser adapters (no DB constraints).
- [ ] Define shared validation schema helper functions in `packages/shared`.
