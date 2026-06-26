# Design Spec: PWA UI Black Apple Ledger Preview

* **Date**: 2026-06-26
* **Phase**: 5.7A
* **Status**: Updated - Option E Black Apple Ledger Selected

---

## 1. Goal

Create a high-fidelity interactive design preview showing the selected **Black Apple Ledger** direction for Miraichi's mobile-first PWA betting journal at `/preview`.

The preview must feel like a real app surface, not a theme picker. It must remain static, generic, and preview-only.

---

## 2. Non-Final UI Disclaimer & Modularity Strategy

> [!IMPORTANT]
> **Non-Final UI Design Notice**: This layout, typography, and styling is an interactive visual direction preview and **NOT** the final production UI design.

Modularity rules:

1. **Centralized Design Tokens**: Main colors, text colors, radii, borders, and safe-area values are controlled through `:root` CSS variables.
2. **Semantic CSS**: Class names describe structure and behavior instead of theme names.
3. **Isolated Component Shells**: Tabs, segmented controls, ledger rows, sheets, navigation, and search filtering can be refactored independently.
4. **No Side Effects**: JavaScript controls local UI state only.

---

## 3. Selected Design Direction

### Option E: Black Apple Ledger

* **Typography**:
  * Use the Apple-like system stack: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `SF Pro Display`, `Segoe UI`, and sans-serif fallbacks.
  * Do not use external Google Fonts.
  * Do not use a serif display title for `Today`.
* **Palette**:
  * Background: `#000000` and `#050505`.
  * Surfaces: `#111113`, `#1c1c1e`, and `#242426`.
  * Borders: `rgba(255,255,255,0.08)` hairlines.
  * Accent: restrained iOS-like blue `#0a84ff`.
  * Amber is allowed only for caution/boundary notes.
* **Today Screen**:
  * Compact header, date tile, summary rows, segmented filter, match ledger, assistant note, and Add Bet action.
  * Summary copy must stay preview-safe: `Points snapshot`, `Manual ledger`, `No formula run`.
* **Other Screens**:
  * `Matches`: search/filter row and grouped generic match rows.
  * `Bets`: manual drafts and static records only.
  * `Bankroll`: points-only snapshot; no trend chart.
  * `Miraichi`: assistant inbox/context notes only.
* **Sheets**:
  * Add Bet sheet: compact fields, disabled save until mock-valid input, no storage.
  * Review sheet: static draft details and boundary note.

---

## 4. Explicitly Removed From Selected Direction

* `Playfair Display`, `Outfit`, or any other Google Font dependency.
* Green glow, emerald borders, or glowing green FAB.
* Sparkline or trend chart in the header.
* `Bankroll Balance`, `vs Yesterday`, `Potential Winnings`, or similar financial-return copy.
* Real teams, leagues, tournaments, providers, predictions, rankings, confidence labels, stake advice, settlement, or persistence.

---

## 5. Preview Architecture

* **Route**: `/preview`, served by `apps/web/src/index.js`.
* **Preview file**: `apps/web/public/preview.html`.
* **Dependencies**: No new framework, package, router, or external script.
* **No Side Effects**: Prevents writing, storage, prediction, math, or backend API activities.

---

## 6. Verification Plan

Run:

```bash
pnpm run typecheck
pnpm run check
pnpm run audit
pnpm run pwa:verify
pnpm --filter web test
pnpm --filter web lint
```

Open:

```text
http://localhost:3010/preview
```

Verify:

* `preview.html` includes `Black Apple Ledger`.
* `preview.html` includes `Today`, `Matches`, `Bets`, `Bankroll`, and `Miraichi`.
* `preview.html` does not include `Playfair Display`, `Potential Winnings`, `vs Yesterday`, or `Bankroll Balance`.
* Mobile `390px x 844px` and desktop `1280px x 900px` have no clipped text or overlapping primary controls.
* Tab switching, match expand/collapse, Add Bet sheet, and Review sheet work.
