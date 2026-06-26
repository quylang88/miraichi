# PWA UI Black Apple Ledger Preview Implementation Plan

> **For agentic workers:** Use a plan-execution workflow and keep the preview within static design-only boundaries.

**Goal:** Revise `/preview` from Tactical Ledger / Modern Premium into **Option E: Black Apple Ledger**.

**Architecture:** Keep the existing `/preview` route in `apps/web/src/index.js` and serve one standalone `apps/web/public/preview.html` file. The preview remains self-contained vanilla HTML, CSS, and JavaScript with no API calls, storage, framework, or business logic.

**Tech Stack:** Vanilla HTML, CSS, JavaScript; existing custom Node HTTP server.

---

## Task 1: Preserve `/preview` Routing

**Files:**

* Modify only if needed: `c:/CODE/miraichi/apps/web/src/index.js`

- [x] Confirm route serves `apps/web/public/preview.html` for `/preview` and `/preview.html`.
- [x] Do not add a router, framework, or package.

---

## Task 2: Implement Black Apple Ledger Preview

**Files:**

* Modify: `c:/CODE/miraichi/apps/web/public/preview.html`

- [x] Replace Modern Premium styling with pure black / charcoal Apple-like minimalism.
- [x] Remove Google Fonts, serif title styling, green glow, sparkline trend cue, and financial-looking trend copy.
- [x] Keep generic data only: `Team Alpha`, `Team Beta`, `Team Gamma`, and similar placeholders.
- [x] Build the real preview screens: `Today`, `Matches`, `Bets`, `Bankroll`, and `Miraichi`.
- [x] Add preview-only local interactions: tab switching, segmented selected states, match expand/collapse, Matches search filtering, Add Bet sheet, and Review sheet.
- [x] Keep Add Bet and Review as non-saving UI state only.

Do not add persistence, API calls, formulas, real teams, real leagues, or recommendation logic.

---

## Task 3: Update Documentation

**Files:**

* Modify: `c:/CODE/miraichi/docs/web/PHASE-5-7A-PWA-UI-DESIGN-DIRECTION-PACK.md`
* Modify: `c:/CODE/miraichi/docs/web/PHASE-5-7A-PWA-UI-DESIGN-OWNER-REVIEW-GUIDE.md`
* Modify: `c:/CODE/miraichi/docs/web/PHASE-5-7A-PWA-UI-DESIGN-PREVIEW-REPORT.md`
* Modify: `c:/CODE/miraichi/docs/web/PHASE-5-7A-PWA-UI-DESIGN-PREVIEW-REVIEW.md`
* Modify: `c:/CODE/miraichi/docs/superpowers/specs/2026-06-25-pwa-ui-design-preview-design.md`
* Modify: `c:/CODE/miraichi/docs/superpowers/plans/2026-06-25-pwa-ui-design-preview.md`
* Modify: `c:/CODE/miraichi/PROJECT_PLAN.md`
* Modify: `c:/CODE/miraichi/ROADMAP.md`
* Modify: `c:/CODE/miraichi/CHANGELOG.md`

- [x] Mark Option E: Black Apple Ledger as the active selected direction.
- [x] Mark Modern Premium as superseded due to green glow and financial-looking visual noise.
- [x] Keep old A/B/C directions superseded or rejected.
- [x] Preserve preview-only restrictions.

---

## Task 4: Verify

- [ ] Static content checks:
  * `preview.html` includes `Black Apple Ledger`.
  * `preview.html` includes `Today`, `Matches`, `Bets`, `Bankroll`, and `Miraichi`.
  * `preview.html` does not include `Playfair Display`, `Potential Winnings`, `vs Yesterday`, or `Bankroll Balance`.

- [ ] Project verification:
  ```bash
  pnpm run typecheck
  pnpm run check
  pnpm run audit
  pnpm run pwa:verify
  pnpm --filter web test
  pnpm --filter web lint
  ```

- [ ] Rendered UI verification:
  * Open `http://localhost:3010/preview`.
  * Check mobile `390px x 844px` and desktop `1280px x 900px`.
  * Verify tab switching, match expand/collapse, Add Bet sheet, Review sheet, no overlap, no clipped text, no console errors.
