# Provider-neutral serving store

The serving store is a materialized API projection, not raw provider evidence.

Publication must remain atomic: validate a complete canonical candidate, write a new immutable version, and update `manifest.json` last. A source timeout, 429, 5xx, malformed response, partial response, or coverage gap must preserve the last good version.

The current repository has no active external match-source worker. Existing local serving artifacts, if any, are not evidence that a replacement provider has passed integration or staging.

Useful provider-neutral commands:

```bash
pnpm run data:build:serving:matches
pnpm run data:validate:serving:matches
pnpm run data:sync:serving:cloud
pnpm run verify:local
pnpm run test:integration
```

Do not run a real source smoke until the owner separately approves the staging request boundary.
