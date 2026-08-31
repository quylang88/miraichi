# FotMob Unofficial Season Source Design

## Goal

Hydrate the canonical registry by provider season, current tier first, without any date-by-date
season crawl or competition-specific core logic.

## Architecture

The registry declares source capability and mapping. The planner resolves canonical seasons and
provider season labels, preserving registry order and a hard tier barrier. A provider client owns
only URL safety, bounded I/O, ETag handling, response validation, and block signals. An adapter owns
terminal-only normalization. The job owns checkpointing, raw evidence, merge, and one atomic
publication per batch.

Checkpoint identity is provider + canonical competition + canonical season. Optional ETag and
cursor remain values inside the checkpoint. A response whose selected provider season differs from
the planned label is a deferred failure and cannot become a success checkpoint.

Only canonical/provider season pairs with explicit mapping evidence are eligible. A syntactically
obvious year conversion is not enough to make a historical target executable; this is especially
important for split stages, transition seasons, shifted one-match editions, and non-annual cups.

## Current-first sequencing

1. Plan incomplete current targets in canonical registry order.
2. Do not enter past-1 while any enabled current target is incomplete or deferred.
3. After current completes, repeat registry order for past-1, then past-2.
4. A newly enabled competition has no current checkpoint and therefore reopens the current tier.

No live polling occurs in hydration. Daily results use a separate global-date pipeline. Match
detail is lazy after FT. Neither pipeline is a prerequisite for the first current-season batch.

## Fail-closed rules

- Direct unauthenticated HTTPS GET only; no browser/session impersonation or anti-bot bypass.
- A 403/429 response aborts further FotMob requests in that run.
- Response body is bounded and covered by the same timeout as headers.
- In-progress scores are never canonicalized.
- Invalid final score, missing team identity, unsafe season label, or mismatched selected season is
  rejected.
- Active data is merged and atomically republished; it is never deleted or replaced with an empty
  candidate.
