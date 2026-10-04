# Roadmap

## Completed: Owner-Only Product Reset

- Four primary tabs: `Today`, `Matches`, `Bets`, `Bankroll`.
- Factual, provider-neutral match contracts for club and national-team competitions.
- Versioned local serving store with cloud snapshot fallback.
- Manual bet/odds and bankroll persistence, backup, and restore boundaries.
- Executable product-boundary verification.
- Superseded runtime, provider integration, generated data, phase gates, and active documentation removed while Git history remains intact.

## Next: Website Source Selection And Crawler Boundary

The next phase is planning only. It must:

1. identify candidate public websites;
2. assess access terms, robots guidance, stability, rate limits, and field coverage;
3. define cache, retry, freshness, provenance, and failure behavior;
4. define an owner-managed competition allowlist;
5. accept one source ADR before implementation.

## After Source Approval

- Write an implementation plan with TDD slices.
- Implement one removable crawler adapter in `apps/worker`.
- Normalize factual data into the canonical warehouse.
- Build and publish the configured-competition serving projection.
- Verify API/web behavior for fresh, stale, empty, and unavailable states.
- Run release, staging, owner-feedback, and production gates in order.

No automatic betting advice or calculation phase exists in this roadmap.
