# Model Boundaries

Task separation between ML predictions and LLM chat features.

## Purpose
Sets limits on LLM decision making vs automated ML statistical checks.

## Status
- **Status**: Active

## Scope
Directs prompt routing templates, response rules, and API safety nets.

## Guidelines
- LLM agents must not calculate betting limits or risk directly. They query predictions/risk stats and translate results into chat text.
- Do not let the LLM change bankroll allocations directly.

## TODO / Next Steps
- [ ] Implement system boundaries middleware validations.
