# PWA instant startup

Owner requested fixing slow Home Screen startup and deploying/verifying the result on existing
Frankfurt staging on 2026-09-13. This is a bounded UI quality correction under existing hosting.

## Diagnosis and contract

The index contains only a loading message. Auth bootstrap waits for the remote session before
importing the unbundled shell dependency graph. The worker precaches eleven URLs, excluding the
shell entry, registration module, locale JSON and most dependencies. Empty owner data does not
remove these startup network dependencies.

Render the data-free, four-tab shell immediately; navigation must work while authentication is
pending. Private reads, writes and LIVE/detail activity still require successful server-side
authentication. Never cache session/API responses or infer authentication from browser storage.
Unknown balances remain unknown. Bound session failure and provide recovery. The complete static
startup code must be cached for subsequent launches, with an atomic version change.

## TDD slices and verification

1. `apps/web/src/auth-bootstrap.test.ts`, `apps/web/src/index.ts`,
   `apps/web/src/auth-bootstrap.ts`: RED for shell markup before JS/API, navigation while a session
   is delayed, preserved chosen tab after authentication, protected controls disabled, and bounded
   failed-session recovery. Implement only data-free startup rendering and navigation; retain the
   authenticated dynamic shell gate. Browser regression: `tests/e2e/pwa-startup.ts`.
2. `apps/web/scripts/build-static.ts`, `apps/web/scripts/build-static.test.ts`,
   `apps/web/public/service-worker.ts`: RED for self-contained browser bundles, full startup
   precache, query-string navigation cache hits, foreign cache preservation and API exclusion.
   Bundle with the existing esbuild dependency; no new infrastructure or dependencies.
3. Run focused checks then `pnpm run verify:staging` and Cloudflare artifact verification.
   Record baseline and candidate browser timings, actual authenticated flows, delayed API/expired
   session behavior, installed offline startup and Chromium/WebKit layout/cache results. Deploy
   only the existing Worker with its unchanged public bindings and retained gateway secret.
   Run the fresh hosted staging gate. Keep performance observations separate from simulated tests.

No provider refresh policy, schema, source, historical hydration or production change. The owner
explicitly requested a local commit after staging verification; commit `c3aacf8` records this
correction. Push and production remain unapproved. Rollback is the pre-change Worker version;
Edge remains version 19.
