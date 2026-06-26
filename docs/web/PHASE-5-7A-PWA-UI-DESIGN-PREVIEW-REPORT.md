# Phase 5.7A PWA UI Design Preview Report

* **Date**: 2026-06-26
* **Phase**: 5.7A
* **Status**: Completed - Updated to Option E Black Apple Ledger

This report documents the revised Phase 5.7A interactive visual design preview.

---

## 1. Scope

Phase 5.7A remains visual design exploration and preview only.

* **Included**: Replacing the Modern Premium preview with one realistic **Black Apple Ledger** app preview at `/preview`.
* **Included**: Pure black background, charcoal surfaces, hairline borders, system typography, restrained iOS-like blue accent, and non-glowing Add Bet action.
* **Included**: Static mock screens for `Today`, `Matches`, `Bets`, `Bankroll`, and `Miraichi`.
* **Included**: Preview-only Add Bet sheet, Review sheet, expandable match ledger rows, bottom tab switching, search filtering, segmented controls, and assistant note.
* **Removed**: Google Fonts, Playfair-style title, green glow, sparkline trend cue, financial trend copy, and potential-winnings copy.
* **Excluded**: No business logic, prediction algorithms, staking, bankroll formulas, settlement formulas, persistence, IndexedDB, database work, bookmaker integration, or real data.

---

## 2. Files Changed

* `apps/web/src/index.js`
  * Keeps serving `apps/web/public/preview.html` for `/preview` and `/preview.html`.
* `apps/web/public/preview.html`
  * Replaced the visual system with the Black Apple Ledger preview.
* `docs/web/PHASE-5-7A-PWA-UI-DESIGN-DIRECTION-PACK.md`
  * Records Option E as the selected direction and marks Modern Premium as superseded.
* `docs/web/PHASE-5-7A-PWA-UI-DESIGN-OWNER-REVIEW-GUIDE.md`
  * Updates review instructions for minimalism, contrast, tab behavior, and sheet behavior.
* `docs/web/PHASE-5-7A-PWA-UI-DESIGN-PREVIEW-REPORT.md`
  * This report.
* `docs/web/PHASE-5-7A-PWA-UI-DESIGN-PREVIEW-REVIEW.md`
  * Updates compliance notes for Black Apple Ledger.
* `docs/superpowers/specs/2026-06-25-pwa-ui-design-preview-design.md`
  * Aligns the design spec with Option E.
* `docs/superpowers/plans/2026-06-25-pwa-ui-design-preview.md`
  * Aligns the implementation plan with Option E.

---

## 3. Technical Preview Structure

The preview uses the existing dedicated `/preview` route. The route serves one standalone HTML file:
`apps/web/public/preview.html`

The preview remains:

1. **Standalone**: one HTML file, no new router, framework, package, or build step.
2. **Token-driven**: key colors, radii, text colors, borders, and safe-area values are centralized in CSS variables.
3. **Preview-only**: all interactions are local UI state. No storage, network call, formula, prediction, or recommendation behavior exists.

---

## 4. Design Decision

The selected direction is **Option E: Black Apple Ledger**.

Why:

* Pure black removes the visual noise that made the previous green premium version feel busy.
* System typography is closer to iOS clarity and avoids unnecessary font dependency.
* iOS-like blue works better as a restrained interaction accent than green glow.
* Removing trend charts and potential-return copy keeps the preview away from implied financial advice or hidden formulas.
* Adding real screens and sheets makes the preview judge the product experience, not just the Today skin.

---

## 5. How Owner Can Inspect Preview

Run:

```bash
pnpm --filter web dev
```

Open:

```text
http://localhost:3010/preview
```

Recommended viewport checks:

* Mobile: `390px x 844px`.
* Desktop: `1280px x 900px`.

---

## 6. Verification Commands

The Black Apple Ledger update should be verified with:

| Command | Expected Result |
| :--- | :--- |
| `pnpm run typecheck` | Pass |
| `pnpm run check` | Pass |
| `pnpm run audit` | Pass |
| `pnpm run pwa:verify` | Pass |
| `pnpm --filter web test` | Pass |
| `pnpm --filter web lint` | Pass |

Rendered verification should also confirm:

* `/preview` returns HTTP `200`.
* The page title is `Miraichi - Black Apple Ledger Preview`.
* `Today`, `Matches`, `Bets`, `Bankroll`, and `Miraichi` tabs switch visible content.
* Add Bet and Review sheets open and close.
* The browser console has no relevant errors.
* Mobile and desktop screenshots have no clipped text, overlapping controls, or framework overlay.

---

## 7. What Remains Blocked

All core calculations, formulas, persistence, real AI behavior, real teams, leagues, providers, databases, and betting integrations remain blocked.
