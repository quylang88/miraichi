# ADR-0049: FotMob Unofficial Source Boundary

- Status: Accepted
- Owner approval: 2026-08-31
- Verified: 2026-08-31

## Decision

Miraichi may use FotMob's unauthenticated, unofficial `/api/data/*` JSON endpoints as the
owner-local primary fixture, terminal-result, and lazy terminal-detail source for the canonical
50-competition registry. ESPN may exist only as a disabled fallback. This is a deliberate owner
acceptance of contractual and operational risk, not a claim that either source grants API use.

The implementation remains provider-neutral above the adapter boundary. Competition mappings,
provider season labels, endpoint kinds, and source capabilities live in configuration. Core
hydration code must not switch on competition names or manufacture a provider season.

## Contract and operational risk

FotMob's published terms prohibit automatic services and systematic use, and its `robots.txt`
disallows `/api/*`. ESPN/Disney terms also prohibit automated extraction and database creation.
Attribution does not cure these restrictions. The owner nevertheless approved FotMob unofficial
use for this owner-only project on 2026-08-31.

This approval does not authorize:

- CAPTCHA bypass, proxy rotation, session theft, login automation, browser fingerprint spoofing,
  or impersonating a crawler/browser;
- retry storms or attempts to work around HTTP 403/429;
- redistribution, commercial use, public staging, or production promotion;
- making ESPN fallback active without a new owner decision.

Repeated HTTP 403 or 429 responses must fail closed for the run. Provider removal must leave the
canonical data and contracts usable.

## Source capabilities

| Capability | FotMob endpoint | Policy |
|---|---|---|
| Competition directory | `/api/data/allLeagues` | verification only; mappings are pinned in registry |
| Season fixtures/results | `/api/data/leagues?id={id}&ccode3={ccode}&season={providerSeason}` | current-first hydration; ETag checkpoint |
| Daily terminal results | `/api/data/matches?date={YYYYMMDD}&timezone={iana}&ccode3={ccode}` | separate pipeline; filter registry; terminal rows only |
| Match detail | `/api/data/matchDetails?matchId={id}` | lazy after terminal status only; optional fields remain nullable |

Season hydration never polls live data and never walks dates. It processes current competition
1 through 50, then past-1 in the same order, then past-2. Adding a new enabled registry entry makes
its current target eligible before any older tier continues.

## Data-quality boundary

The season response's `details.selectedSeason` must equal the binding's expected provider-season
label. A fallback to a prior edition is deferred and is never checkpointed as current. In-progress
rows may be retained only in bounded raw evidence; no live score or event is published. Completed
rows require a valid non-negative final score. Match details are best-effort because event, lineup,
statistics, and shot-map coverage varies by competition.

## Consequences

This choice can reach more competitions with fewer requests than date hydration, but it is not a
stable or licensed data contract. The provider can change fields or block the runtime without
notice. Local verification is not staging or production approval.

