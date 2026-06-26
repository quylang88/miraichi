# Phase 5.8 UI Flexibility Architecture

This document recommends the technical architecture for the Miraichi web client to ensure that future UI modifications are low-cost, maintainable, and internationalization-ready. No code changes are implemented in this phase.

---

## 1. Design Tokens (CSS Variables)

To allow global style adjustments without touching HTML files, we recommend structuring design tokens as CSS variables.

### 1.1 Palette & Semantic Color Tokens
```css
:root {
  /* Functional Greys / Base */
  --bg-color-pure: #000000;
  --bg-color-raised: #050505;
  --surface-color-primary: #111113;
  --surface-color-secondary: #1c1c1e;
  --surface-color-tertiary: #242426;

  /* Hairlines and Borders */
  --border-color-subtle: rgba(255, 255, 255, 0.08);
  --border-color-strong: rgba(255, 255, 255, 0.14);

  /* Interaction & Accents */
  --accent-color-primary: #0a84ff;         /* iOS Blue */
  --accent-color-primary-soft: rgba(10, 132, 255, 0.16);
  --accent-color-warning: #ff9f0a;         /* iOS Amber */
  --accent-color-warning-soft: rgba(255, 159, 10, 0.12);
  --accent-color-danger: #ff453a;          /* iOS Red */
  --accent-color-danger-soft: rgba(255, 69, 58, 0.12);

  /* Typography Colors */
  --text-color-primary: #f5f5f7;
  --text-color-muted: #a1a1a6;
  --text-color-subtle: #6e6e73;
}
```

### 1.2 Spacing & Radius Tokens
```css
:root {
  /* Layout Spacing Grid */
  --spacing-xxs: 4px;
  --spacing-xs: 8px;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 20px;
  --spacing-xl: 24px;
  --spacing-xxl: 32px;

  /* Boundary Radii */
  --radius-control: 8px;
  --radius-card: 12px;
  --radius-sheet: 18px;
  --radius-app-shell: 32px;
}
```

---

## 2. Component Structure and Class Naming

Components should follow a strict class-naming convention (BEM-lite or namespaced variables) to keep styling local to the component boundary and avoid cross-contamination.

### 2.1 CSS Layout Primitives
* **Flex Centering**: `.layout-center`
* **Flex Row**: `.layout-row` (with `--gap` override support)
* **Flex Column**: `.layout-column` (with `--gap` override support)
* **Scroll Area**: `.layout-scrollable` (handling touch physics)

### 2.2 Bottom Navigation Component (`.nav-bar`)
* **Behavior**: Fixed position at bottom, inset by `--safe-bottom` using standard CSS layout bounds.
* **Flexibility**: Define tabs as config items in JS (e.g. key, icon path, title key). The navigation component renders tabs dynamically.
* **BEM Scope**:
  * `.nav-bar` (container)
  * `.nav-bar__item` (tab button)
  * `.nav-bar__item--active` (active state modification)
  * `.nav-bar__label` (text caption, hidden on ultra-small screens)

### 2.3 App Shell Component (`.app-shell`)
* **Responsibility**: Constrain maximum width, manage vertical layout structure, and handle system overlays (safe area top/bottom).
* **BEM Scope**:
  * `.app-shell` (outer viewport)
  * `.app-shell__top-bar` (header)
  * `.app-shell__content` (active tab viewport)
  * `.app-shell__bottom-bar` (navigation viewport)

### 2.4 Tab View Components (`.tab-view`)
* **Responsibility**: Manage active/inactive transitions of content pages.
* **Structure**: Each tab is represented by a separate DOM container marked `.tab-view__panel`.
* **State Control**: Use `[hidden]` attribute or `.tab-view__panel--active` CSS classes to manage visibility.

### 2.5 Sheet / Modal Component (`.bottom-sheet`)
* **Responsibility**: Bottom-anchored sliding sheet overlay for inputs (like Add Bet or Review details).
* **BEM Scope**:
  * `.bottom-sheet` (overlay wrapper)
  * `.bottom-sheet__backdrop` (dimmer background)
  * `.bottom-sheet__surface` (container slide-up)
  * `.bottom-sheet__handle` (drag strip indicator)
  * `.bottom-sheet__close-btn` (accessibility close button)

---

## 3. Boundaries and Isolation

To prevent design regression, we establish two architectural boundaries.

### 3.1 App Settings Isolation Boundary
* **UI Isolation**: The Settings view component reads only from the Local Settings Service interface. It has no direct database or network access.
* **Storage Abstraction**: The settings service acts as a mediator, exposing getter/setter methods. Under the hood, it writes to `localStorage` or `IndexedDB`, but the UI doesn't care.

### 3.2 Copy / Text Translation Boundary (i18n Readiness)
* **No hardcoded text inside JS components**: All string literals must be resolved via a translation helper (e.g., `t('bets.add_bet')`).
* **Clean DOM templates**: HTML markup must contain data attributes (`data-i18n="bets.add_bet"`) instead of raw text nodes, allowing a future localization utility to traverse the DOM and populate translations seamlessly without breaking structural logic.
