# Shared Types

## Factual Match Domain

- `LocalMatch`, `LocalMatchDetail`, and snapshot/feed contracts.
- `LocalCompetitionType`: `club | national-team`.
- Provider-neutral raw envelopes, canonical entities, provider links, and field provenance.

## Owner Domain

- Manual odds and bet record contracts.
- Bet draft and backup contracts.
- Bankroll account and ledger contracts.
- Cloud persistence status and snapshot contracts.

Shared contracts must not embed a provider ID into canonical entity IDs or make one competition type structurally privileged.
