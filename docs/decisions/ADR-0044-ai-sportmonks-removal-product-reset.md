# ADR-0044: AI And Sportmonks Removal Product Reset

- **Status**: Accepted
- **Date**: 2026-08-01
- **Owner approval**: Explicitly approved in the product-reset task.

## Context

The repository had accumulated a local prediction/training runtime, assistant routes and UI, provider-specific capture code, generated provider data, and roadmap phases that no longer matched the desired product. Maintaining those paths increased disk usage, verification cost, and architectural confusion.

## Decision

Miraichi is an owner-only factual match, manual bet/odds, and bankroll web application. Local AI and Sportmonks are removed. Git history is retained.

The primary navigation is exactly `Today`, `Matches`, `Bets`, and `Bankroll`. Runtime prediction, chat, explanation, model training, recommendation, and automated betting-calculation surfaces are outside the product.

Factual data contracts remain provider-neutral and accept both club and national-team competitions selected by an owner-configured allowlist. A replacement website source is not chosen by this decision; it requires a separate source-selection ADR.

## Consequences

- Removed tracked code and documents remain recoverable from Git history.
- Approved untracked raw data and local environments were permanently deleted and are not recoverable from Git.
- Existing factual serving-store and owner persistence boundaries remain.
- Missing match data is shown as empty, stale, or unavailable; no hardcoded or retired-provider fallback is allowed.
- `verify:product-boundary` prevents accidental reintroduction of removed paths, commands, routes, or the fifth tab.
