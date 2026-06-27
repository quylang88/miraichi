# Phase 5.8 Production Shell Readiness Plan

This document plans the future Phase 5.9 Production PWA Shell implementation. No code changes are executed in Phase 5.8.

---

## 1. Scope & Execution Principles for Phase 5.9

The goal of Phase 5.9 will be to build the real, functional web client shell serving the default `/` dashboard.

### 1.1 Key Principles
1. **Reuse the Approved Aesthetics**: Port the Black Apple Ledger design (Option E) directly into the production code.
2. **Avoid Hardcoded UI Details**: Extract DOM structures, styles, and configurations into structured files.
3. **No Domain Business Logic in UI**: UI must only collect values (e.g. text inputs, select dropdowns) and delegate validation/calculation to decoupled services.
4. **Keep Settings & i18n Ready but Defer Backend Integration**: Define settings structures and i18n lookup patterns, but defer full integration (e.g. cloud backups) until later phases.

---

## 2. Anticipated File Changes in Phase 5.9

We recommend the following monorepo file changes for Phase 5.9:

### 2.1 UI Styling Changes
* **Modify** [packages/ui/src/index.css](file:///c:/CODE/miraichi/packages/ui/src/index.css):
  * Import design tokens (e.g., `--bg-color-pure`, `--radius-app-shell`) defined in the flexibility spec.
  * Standardize utility classes for flex spacing, rounded margins, and dark-mode defaults.

### 2.2 Shell Web Entry Point
* **Modify** `apps/web/src/index.js`:
  * Swap SPA entry path or routing so `/` serves a production-ready template rather than a blank scaffold.
  * Retire `/preview` after the production shell is accepted; production `/` becomes the source-of-truth shell.

### 2.3 New Components (Client-Side TypeScript)
Phase 5.9 must follow ADR-0034 and the repo TypeScript migration direction. New production shell modules should be `.ts`; existing `.js` files may remain only as runtime bridges or legacy entrypoints.

* **New** `apps/web/src/components/app-shell.ts`:
  * Core layout wrapper managing the top brand bar, main tab content view, and bottom navigation.
* **New** `apps/web/src/components/bottom-navigation.ts`:
  * Dynamic tab rendering, handling user click events, updating browser URL history, and firing navigation events.
* **New** `apps/web/src/components/bottom-sheet.ts`:
  * Reusable slide-up sheet overlay logic for forms (e.g., adding a record).
* **New** `apps/web/src/services/settings-service.ts`:
  * Basic local-first settings helper exposing getters/setters (backing up to `localStorage`).

---

## 3. Keep Settings & i18n Hooked (but Deferred)

To avoid costly refactoring in future phases, the production shell should use hooks:

* **Mock Translation Helper**: Introduce a simple placeholder function:
  ```typescript
  // Temporary client translation stub
  export function t(key: string, fallback = ''): string {
    // Phase 5.9 will simply return the fallback or english string.
    // In Phase 5.10+, this will look up keys from language JSON files.
    return fallback;
  }
  ```
* **Placeholder Settings Config**: Include setting keys in the shell's configuration mapping (e.g. `locale`, `theme`), allowing the UI to render option states even before we connect language/theme switches to functional modules.

---

## 4. Cost-Reduction Strategy for Future Layout Tweaks

To ensure design updates remain easy and low-cost:
1. **Decouple markup from style variables**: Use CSS custom properties for spacing and sizes instead of hardcoded pixel sizes in JavaScript files.
2. **Tab Configurations**: Define the navigation tabs in a centralized TypeScript config array:
   ```typescript
   const navigationTabs = [
     { id: 'today', title: 'Today', icon: 'icon-today' },
     { id: 'matches', title: 'Matches', icon: 'icon-matches' },
     { id: 'bets', title: 'Bets', icon: 'icon-bets' },
     { id: 'bankroll', title: 'Bankroll', icon: 'icon-bankroll' },
     { id: 'miraichi', title: 'Miraichi', icon: 'icon-miraichi' }
   ];
   ```
   Adding, re-ordering, or renaming tabs will require updating a single configuration file.
