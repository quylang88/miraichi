# Phase 5.9 Production PWA Shell Report

## Purpose
Document the Phase 5.9 implementation of the production web shell for Miraichi.

## Status
- **Status**: Completed - Verified

## Scope
This report covers the production PWA shell served at `/`, the TypeScript-first shell modules, updated shared UI tokens, and guardrail updates that prevent future new web modules from defaulting back to JavaScript.

---

## 1. Summary

Phase 5.9 replaces the old `/` scaffold with a production PWA shell using the accepted five-tab navigation backbone:

* `Today`
* `Matches`
* `Bets`
* `Bankroll`
* `Miraichi`

The implementation ports the accepted Black Apple Ledger preview structure into production while keeping `/preview` available as the design reference route.

Production `/` now uses the same preview-derived shell language:

* phone-frame app shell on desktop and edge-to-edge mobile shell;
* `top-bar`, `notice`, `main-scroll`, and preview-like `screen` sections;
* Today summary rows, segmented controls, match cards, ledger rows, points rows, and assistant rows;
* match-detail sub-view with match-scoped Add Bet entry;
* Add, Edit, and Review bottom sheets as static shell surfaces.

## 2. Files Changed

Runtime shell:

* `apps/web/src/index.js`
  * Keeps the legacy no-build web server.
  * Serves `/` with `#app-root` and the shell entry module.
  * Adds a TypeScript transpile bridge so browser imports like `/apps/web/src/shell-entry.js` can resolve to source-owned `.ts` modules.
* `apps/web/src/shell-entry.ts`
  * Mounts the shell, handles tab switching, and keeps URL tab state.
  * Provides preview-parity shell interactions: match-detail navigation, bottom sheets, segmented controls, search filtering, and static Add Bet form enablement.
* `apps/web/src/config/navigation-tabs.ts`
  * Defines the five approved stable tab IDs.
* `apps/web/src/components/app-shell.ts`
  * Renders the production shell using preview-parity Black Apple Ledger structure.
* `apps/web/src/components/bottom-navigation.ts`
  * Renders accessible bottom tab buttons using the same `bottom-nav` / `nav-item` structure as the accepted preview.
* `apps/web/src/services/settings-service.ts`
  * Stores shell-only settings such as locale, theme, and display density.
  * Rejects non-shell data such as betting history.
* `apps/web/src/services/i18n-service.ts`
  * Provides fallback-first locale resolution and translation stubs.
* `apps/web/public/service-worker.js`
  * Bumps the shell cache to `miraichi-shell-v3-phase-5-9-preview-parity` so existing cache-first browsers receive the preview-parity production shell.
* `packages/ui/src/index.css`
  * Adds Black Apple Ledger design tokens and production shell classes sourced from the accepted preview structure.

Verification and governance:

* `apps/web/src/production-shell.test.ts`
  * Adds colocated unit coverage for navigation, shell rendering, i18n, and shell-only settings.
* `scripts/pwa-verify.js`
  * Verifies production shell TypeScript modules, accepted tab IDs, preview-parity shell markers, and preview invariants.
* `scripts/verify-lifecycle.js`
  * Requires TypeScript-first markers in docs and skills.
* `.agent/skills/*` and docs updates
  * Explicitly prevent new implementation modules from defaulting to `.js`.

## 3. Boundaries Preserved

This implementation does not add:

* New backend API routes.
* IndexedDB, export/import, cloud sync, auth, database clients, ORMs, schemas, or migrations.
* Betting calculations, settlement formulas, odds conversion formulas, ROI/yield/CLV, stake sizing, bankroll formulas, or risk algorithms.
* Real data providers, prediction algorithms, AI recommendation logic, confidence claims, ranking, or stake advice.
* A new frontend framework or bundler.

## 4. TypeScript-First Correction

During implementation, the first shell slice incorrectly started as new `.js` modules. That was wrong for the current repo direction after ADR-0034 and Phase 5.4.

The implementation was corrected to:

* Use `.ts` for new shell modules.
* Use `*.test.ts` for the new shell test.
* Keep `apps/web/src/index.js` only as a legacy no-build runtime bridge.
* Add lifecycle verification so missing TypeScript-first rules fail future checks.

## 5. Verification

Targeted verification run during implementation:

| Command | Result |
| :--- | :--- |
| `pnpm exec vitest run apps/web/src/production-shell.test.ts` | PASS |
| `pnpm run typecheck` | PASS |
| `pnpm run pwa:verify` | PASS |

Final phase verification:

| Command | Result |
| :--- | :--- |
| `pnpm run verify:local` | PASS |
| `pnpm run test:integration` | PASS |
| `pnpm run verify:release` | PASS |

Rendered runtime check:

* Opened `http://localhost:3011/` with Playwright CLI.
* Confirmed shell renders `Today`.
* Clicked `Bets` and confirmed URL changed to `?tab=bets` and the `Manual bet journal` panel rendered.
* Opened match detail from production and confirmed the match-scoped Add Bet sheet opens.
* Confirmed browser console had no error after favicon and service worker cache updates.

## 6. Next Phase

The next recommended phase is **Phase 5.10 Add Bet Draft/Form State + Persistence Planning**.

Phase 5.10 should stay planning/contract-focused first:

* Define type-only Add Bet draft/form-state contracts.
* Plan local-first persistence adapter boundaries under ADR-0033.
* Plan backup envelope and import/export failure states.
* Do not implement IndexedDB until a separate owner-approved implementation plan exists.
