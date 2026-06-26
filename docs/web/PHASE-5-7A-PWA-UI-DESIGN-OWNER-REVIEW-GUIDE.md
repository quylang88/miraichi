# Phase 5.7A PWA UI Design Owner Review Guide

* **Date**: 2026-06-26
* **Phase**: 5.7A
* **Status**: Updated for Option E Black Apple Ledger

This guide explains how to inspect the revised **Black Apple Ledger** preview.

---

## 1. How to Inspect the Preview

1. **Start the local server**:
   ```bash
   pnpm --filter web dev
   ```
   Or run:
   ```bash
   node apps/web/src/index.js
   ```

2. **Open the preview URL**:
   ```text
   http://localhost:3010/preview
   ```

3. **Check mobile viewport**:
   * Use `390px x 844px` or `375px x 812px`.
   * Confirm the first viewport shows the Today header, summary rows, Match Ledger, Add Bet action, and bottom navigation without overlap.

4. **Check desktop viewport**:
   * Use `1280px x 900px`.
   * Confirm the preview remains centered as a mobile app surface instead of expanding into a desktop dashboard.

---

## 2. What to Review

Review the preview as a real app workflow, not as a theme comparison.

* **Focus**: Does the pure black background make the workflow calmer and easier to scan?
* **Hierarchy**: Are title, summary rows, ledger rows, tabs, and sheets clearly prioritized?
* **Color restraint**: Does blue appear only where interaction needs it?
* **Tab behavior**: Do all five tabs feel like the same design system?
* **Sheet behavior**: Do Add Bet and Review sheets feel compact, readable, and preview-safe?
* **Boundary safety**: Does the UI avoid prediction, confidence, ranking, stake advice, and return calculation language?

### Black Apple Ledger Design Elements

Verify:

* **Pure black base**: Main background should be `#000000` or near-black, not a colorful gradient.
* **Charcoal surfaces**: Cards, rows, and sheets should use restrained graphite surfaces with hairline borders.
* **System typography**: No external Google Fonts, no serif title treatment.
* **Interaction accent**: Selected tabs, primary actions, and focus states use restrained iOS-like blue.
* **No visual noise**: No green glow, no sparkline trend cue, no glassmorphism, no neon.

> [!NOTE]
> This is a **visual exploration direction** and **NOT the final UI design**. Future production implementation still needs a separate plan.

---

## 3. Interaction Checks

Inside the preview:

* Click `Matches`, `Bets`, `Bankroll`, and `Miraichi` in the bottom navigation.
* Click `Add Bet` and confirm the preview sheet opens.
* Enter mock-valid Add Bet fields and confirm `Save Draft` becomes enabled.
* Close the Add Bet sheet and confirm no data is saved.
* Expand and collapse match ledger rows.
* Click `Review` and confirm the Review sheet opens.
* Search in `Matches` and confirm generic rows filter locally.

All interactions are preview-only.

---

## 4. Feedback to Provide

Useful feedback:

* Whether the UI is now too sparse, still too dense, or correctly focused.
* Whether iOS-like blue should remain the only accent.
* Whether Add Bet should remain a floating action or move into the top bar later.
* Whether the Bankroll tab should stay as a points-only snapshot or be renamed later.
* Whether the assistant inbox should be more prominent in the real app shell.

Not useful at this phase:

* Requests for real predictions, real teams, formulas, storage, settlement behavior, or stake advice. Those remain blocked by existing ADR boundaries.

---

## 5. Decision Before Phase 5.7B

Phase 5.7B should not start until the owner explicitly accepts Black Apple Ledger as the production visual basis or requests a specific revision.
