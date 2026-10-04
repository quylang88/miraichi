# API Architecture

`apps/api` is a Node.js HTTP mediation layer.

- Routes validate requests and map responses.
- Match routes use the `MatchSnapshotRepository` boundary.
- `ServingMatchStoreRepository` reads versioned local factual data.
- `CloudMatchSnapshotRepository` reads the owner cloud snapshot.
- `FallbackMatchSnapshotRepository` falls back only when the local store is missing; malformed local data remains an error.
- Bet, bankroll, and backup routes use the cloud-persistence adapter and `owner-primary` scope.

The browser never connects directly to the database or a third-party source. A future crawler writes through the worker/warehouse/serving pipeline, not through web routes.
