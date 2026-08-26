# Local API data

This directory is the provider-neutral local data root. Generated raw evidence, source ledgers, warehouse versions, match-detail caches, and serving versions are intentionally ignored by Git.

## Current state

No external match provider is implemented or active. The worker must remain idle until a SportScore code slice passes its terminal-only publication and scheduler tests.

Tracked files preserve only directory structure and operating guidance. They are not match data.

## Store boundaries

- `providers/<source>/` may contain private raw evidence and source-specific checkpoints after that source is implemented.
- `warehouse/` contains immutable provider-neutral canonical versions.
- `serving/` contains the sanitized materialized snapshot consumed by the Miraichi API.
- `match-details/` contains terminal factual detail projections only.

Never copy real credentials, provider URLs containing secrets, or provider entity IDs into serving payloads. Unit and integration tests must use temporary roots.
