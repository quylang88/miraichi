# Phase 5.7A PWA UI Design Direction Pack

* **Date**: 2026-06-26
* **Phase**: 5.7A
* **Status**: Updated - Option E Black Apple Ledger Selected

This document records the selected Phase 5.7A preview direction for the Miraichi mobile-first PWA betting journal interface.

---

## 1. Selected Direction

### Option E: Black Apple Ledger (Selected)

* **Design Intent**: Show a real daily app surface instead of a theme picker. The preview focuses on `Today`, grouped match ledger work, manual record review, assistant context, Add Bet access, and the fixed five-tab navigation.
* **Visual Personality**: Pure black, restrained, high-clarity, and iOS-inspired. The UI should feel like a serious mobile tool, not a betting promo screen.
* **Typography**: System font stack only: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `Segoe UI`, and sans-serif fallbacks. No external Google Fonts and no serif display header.
* **Palette**: Pure black and near-black base (`#000000`, `#050505`), charcoal surfaces (`#111113`, `#1c1c1e`), hairline borders (`rgba(255,255,255,0.08)`), white/gray text, and restrained iOS-like blue (`#0a84ff`) for interaction.
* **Layout Model**: One realistic mobile app viewport with a compact top bar, preview notice, summary list, segmented filters, ledger rows, assistant note, non-glowing Add Bet action, bottom navigation, and iOS-style sheets.
* **Screens Covered**: `Today`, `Matches`, `Bets`, `Bankroll`, and `Miraichi`.
* **Modal Coverage**: Add Bet bottom sheet and Review bottom sheet are preview-only, local UI state only, and do not save data.
* **Boundary Copy**: Uses safe labels such as `Points snapshot`, `Manual ledger`, `No formula run`, and `Preview only`.

> [!IMPORTANT]
> This is a design direction preview and **NOT** the final production UI. It does not authorize production betting workflows, formulas, storage, AI recommendations, or real data integration.

---

## 2. Superseded Directions

| Direction | Status | Reason |
| :--- | :--- | :--- |
| Tactical Ledger (Modern Premium) | Superseded | Still had too much green glow, sparkline-like financial visual noise, and premium styling that distracted from the actual journal workflow. |
| Tactical Ledger (Original) | Superseded | Correct workflow model, but not minimal or iOS-like enough for the revised owner direction. |
| Tactical Pitch | Superseded | Readable but too flat and still framed as a theme option instead of a real product screen. |
| Sportsbook Neon | Rejected | Too close to generic betting-platform gloss; purple/neon/glass effects weaken trust and readability. |
| Monochrome HUD | Rejected | Too polarizing and slower to read; cyber/terminal styling distracts from journal work. |

The blunt conclusion: the previous green premium direction was visually stronger than the old theme picker, but still too decorative. Option E is the cleaner product direction.

---

## 3. Review Criteria

| Criteria | Black Apple Ledger Decision |
| :--- | :--- |
| **Focus** | High. Pure black background and fewer colored elements keep attention on the workflow. |
| **Legibility** | High. System typography and high-contrast text improve mobile reading. |
| **Product Fit** | High. Looks like a disciplined journal tool, not a sportsbook skin. |
| **Visual Restraint** | High. No green glow, no glassmorphism, no neon, no sparkline trend cue. |
| **Performance** | High. Pure HTML/CSS/JS, no framework and no external font dependency. |
| **Risk** | Low. The preview remains static and boundary-safe. |

---

## 4. Owner Decision

The selected Phase 5.7A preview direction is **Option E: Black Apple Ledger**.

Future Phase 5.7B work should use this direction only after a separate owner-approved production implementation plan.

---

## 5. Deferred Items

The following remain out of scope:

* Production stylesheet finalization.
* Framework/router replacement.
* Real match, league, team, provider, or tournament data.
* IndexedDB, persistence, backup, or sync.
* Staking, bankroll, ROI, yield, CLV, settlement, or risk formulas.
* Real prediction models, confidence claims, recommendation ranking, or stake advice.
