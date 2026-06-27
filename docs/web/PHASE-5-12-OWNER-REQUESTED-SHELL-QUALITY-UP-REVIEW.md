# Phase 5.12 Owner-Requested Shell Quality-Up Review

## Purpose
Record the owner-requested Phase 5.12 UI/UX quality-up before Phase 5 closeout.

## Status
- **Status**: Completed - Staging Redeployed and Smoke-Checked

## Scope
This phase improves the existing web/PWA shell after staging feedback. It does not approve production, does not perform final owner review, does not add real match providers, does not create API routes, does not create production schemas, and does not add betting formulas, prediction logic, recommendation ranking, auth, cloud sync, or secrets.

## Owner Requested Changes

| Request | Result | Evidence |
| :--- | :---: | :--- |
| Remove the two top shell sections above the main Miraichi shell | PASS | `top-bar` and `notice` are removed from `renderAppShell`; PWA verifier now fails if they return. |
| Today right-side badge must show the current date, not `5.9 PWA` | PASS | `getTodayDateTileParts()` renders current day/month; unit test covers the date tile. |
| Remove the redundant `Choose Match to Add` button | PASS | Bets tab no longer renders that CTA; unit and browser checks confirm absence. |
| Change Matches tab icon to a more suitable stadium-style icon | PASS | Bottom navigation uses a stadium-style SVG with `data-icon="stadium"`; unit and browser checks confirm marker. |
| Remove unnecessary extra hardcoded sample rows | PASS | Extra `Team Echo`, `Team North`, `Team South`, and `Foxtrot` sample rows were removed. |
| Hide the right-side app scrollbar while preserving shell scrolling | PASS | `.main-scroll` keeps vertical scrolling but hides WebKit/Firefox/MS scrollbars; Chrome check confirmed `::-webkit-scrollbar` width is `0px`. |
| Force cached browsers to receive the quality-up shell | PASS | Service worker cache name bumped from Phase 5.9 to `miraichi-shell-v5-phase-5-12-quality-up`. |
| Keep local dev changes visible immediately on `localhost:3011` | PASS | Localhost service worker registration now unregisters service workers and deletes shell caches instead of registering cache-first PWA assets. |

## Verification

Commands passed:

```powershell
pnpm exec vitest run apps/web/src/production-shell.test.ts
pnpm exec vitest run apps/web/src/pwa/register-service-worker.test.js
pnpm run pwa:verify
pnpm run verify:release
pnpm run verify:staging
pnpm run deploy:staging:local
```

Release verification result:

* Lifecycle verification passed.
* Unit tests passed: 18 files, 63 tests.
* JavaScript syntax check passed.
* Typecheck passed.
* Audit rules passed.
* Phase 3 verification passed.
* Phase 4 verification passed.
* Phase 4 integration verification passed.
* Endpoint boundary E2E verification passed.
* PWA verification passed.

Local static artifact smoke:

| URL | Result |
| :--- | :--- |
| `http://127.0.0.1:4178/` | HTTP 200. |
| `http://127.0.0.1:4178/manifest.webmanifest` | HTTP 200. |
| `http://127.0.0.1:4178/service-worker.js` | HTTP 200. |
| `http://127.0.0.1:4178/apps/web/src/shell-entry.js` | HTTP 200. |
| `http://127.0.0.1:4178/packages/ui/src/index.css` | HTTP 200. |

Browser QA:

* Browser plugin used against local static artifact.
* Desktop viewport: Today screen renders without `top-bar` or `notice`, current date tile shows current day/month, no console warnings/errors.
* Interaction: Matches tab opens `screen-matches`, stadium icon marker is present, no `Choose Match to Add` text.
* Interaction: Bets tab opens `screen-bets`, no redundant choose-match CTA, no `top-bar`, no `notice`, no console warnings/errors.
* Mobile viewport `390x844`: no horizontal overflow, no `top-bar`, no `notice`, no `Choose Match to Add`, no console warnings/errors.
* Mobile viewport `390x844`: right-side app scrollbar hidden while `.main-scroll` remains scrollable.

Localhost cache note:

* `localhost:3011` serves source files directly, but the registered service worker uses cache-first shell assets.
* Before this quality-up cache bump, a browser that had already loaded Phase 5.9 could keep serving the old shell from `miraichi-shell-v4-phase-5-9-production`.
* The Phase 5.12 service worker cache is now `miraichi-shell-v5-phase-5-12-quality-up`.
* Localhost now disables service worker registration, unregisters old workers, deletes shell caches, and reloads once after cleanup when needed.

## Staging Redeploy

Staging redeploy passed after the owner configured Cloudflare credentials outside the repository.

```powershell
pnpm run deploy:staging:local
```

Result:

```text
Deployment complete: https://e9b19946.miraichi-staging.pages.dev
```

Smoke evidence captured on 2026-06-27:

| URL | Result |
| :--- | :--- |
| `https://e9b19946.miraichi-staging.pages.dev/` | HTTP 200; root shell contains `Miraichi`, `shell-entry`, and `app-root`. |
| `https://e9b19946.miraichi-staging.pages.dev/manifest.webmanifest` | HTTP 200; manifest name is `Miraichi`. |
| `https://e9b19946.miraichi-staging.pages.dev/service-worker.js` | HTTP 200; contains `miraichi-shell-v5-phase-5-12-quality-up`. |
| `https://e9b19946.miraichi-staging.pages.dev/apps/web/src/shell-entry.js` | HTTP 200; contains `renderAppShell`. |
| `https://e9b19946.miraichi-staging.pages.dev/packages/ui/src/index.css` | HTTP 200; contains `main-scroll`. |

## Match Data Source Decision

The current shell still uses minimal generic placeholder matches. That is intentional for Phase 5.12 because real match-provider work is outside this phase.

Recommended future data path:

* Phase 7 should plan real match provider selection and dataset boundaries.
* First provider target may be full FIFA World Cup fixture coverage, but the adapter must stay competition-agnostic.
* Phase 5 must not hardcode World Cup fixtures into the shell.
* Mock/provider placeholder code should be replaced only after a provider ADR and adapter plan are accepted.

## Conclusion

Phase 5.12 quality-up is implemented, verified locally, redeployed to Cloudflare Pages staging, and smoke-checked. This satisfies the Phase 5.12 closeout gate for Phase 5.
