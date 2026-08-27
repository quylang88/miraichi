# Local API data

This directory is the provider-neutral local data root. Generated raw evidence, source ledgers, warehouse versions, match-detail caches, and serving versions are intentionally ignored by Git.

## Current state

The SportScore source, terminal-only publication, bounded scheduler, and lazy terminal-detail code are implemented locally. Real provider network execution remains disabled by default and has not passed the separately approved staging gate.

Tracked files preserve only directory structure and operating guidance. They are not match data.

## Store boundaries

- `providers/<source>/` may contain private raw evidence and source-specific checkpoints after that source is implemented.
- `warehouse/` contains immutable provider-neutral canonical versions.
- `serving/` contains the sanitized materialized snapshot consumed by the Miraichi API.
- `match-details/` contains terminal factual detail projections only.
- `match-detail-refresh/` contains the bounded lazy-detail queue and negative-cache state.

Never copy real credentials, private provider match IDs, or provider URLs into serving/API payloads. Unit, integration, and local UI smoke tests must use isolated temporary or mock roots.
