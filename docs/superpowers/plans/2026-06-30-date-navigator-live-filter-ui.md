# Date Navigator and LIVE Filter UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Date Navigator bar at the top of the Matches tab and a LIVE filter toggle button next to the search input, then bind events in shell-entry and verify the implementation with unit tests.

**Architecture:** Use a timezone-safe Date parsing & ribbon generator inside `app-shell.ts` to render 5 centered dates around the selected date. Bind click/change events in `shell-entry.ts` to coordinate date shifts, picker triggers, and combined live status & search text filters.

**Tech Stack:** TypeScript, HTML5 template strings, Vanilla CSS (injected via a scoped `<style>` block in component), Vitest.

---

### Task 1: Date Navigator and LIVE Filter rendering in app-shell

**Files:**
- Modify: `apps/web/src/components/app-shell.ts`

- [ ] **Step 1: Write helper functions for generating ribbon dates**
  Define `getRibbonDates(selectedDateStr: string)` that parses a `YYYY-MM-DD` string into local midnight, computes the 5 centered local Dates (`selectedDate - 2` to `selectedDate + 2`), and returns them.
  Implement formatting for the day number and relative/weekday labels ("Today", "Yesterday", "Tomorrow", short name).

- [ ] **Step 2: Add Date Navigator to Matches Panel template**
  Modify `renderMatchesPanel` to:
  - Generate the ribbon dates using the helper.
  - Render `#date-prev-btn`, a scrollable `.date-ribbon` with the 5 date buttons (each having `data-date="YYYY-MM-DD"` and an `active` class if selected), `#date-next-btn`, and `#date-picker-btn` with a hidden `#date-picker-input`.
  - Add inline/scoped `<style>` block with the styled classes for `.date-navigator`, `.date-ribbon`, `.date-chip`, and `#live-filter-btn`.

- [ ] **Step 3: Add LIVE Filter button to search row**
  Modify `renderMatchesPanel` search row to include:
  `<button id="live-filter-btn" type="button">LIVE</button>`
  Update `renderMatchRow` to accept an optional `status` parameter, and update `renderProviderMatchRow` to pass `match.status` to `renderMatchRow` so the match status is stored in a `data-status` attribute on `.match-row`.

- [ ] **Step 4: Commit the UI rendering modifications**
  Check `auto_commit` setting. If true, stage and commit:
  ```bash
  git add apps/web/src/components/app-shell.ts
  git commit -m "feat(web): render date navigator and live filter button in app shell"
  ```

---

### Task 2: Bind events and apply filters in shell-entry

**Files:**
- Modify: `apps/web/src/shell-entry.ts`

- [ ] **Step 1: Implement filter logic combining text search and live status**
  Replace `updateMatchSearch` with `updateMatchFilters()` in `apps/web/src/shell-entry.ts` that:
  - Retrieves query from `#match-search` and checks if `#live-filter-btn` has `active` class.
  - Matches rows based on query text AND `row.dataset.status === 'in_play'` (if LIVE filter is active).
  - Updates display styles and `#matches-empty` visibility.

- [ ] **Step 2: Add persistent filter states across renders**
  Define `currentSearchQuery` and `isLiveFilterActive` variables at the module level.
  In `render(activeTabId)`, restore the input value of `#match-search` and `.active` class of `#live-filter-btn` after rendering, then call `updateMatchFilters()`.

- [ ] **Step 3: Bind Date Navigator and LIVE Filter event listeners**
  In the click event listener on `appRoot`:
  - Handle `#date-prev-btn` click to subtract 1 day from `matchFeedState.date` and refresh.
  - Handle `#date-next-btn` click to add 1 day and refresh.
  - Handle `.date-chip` click to set `matchFeedState.date` to `data-date` and refresh.
  - Handle `#date-picker-btn` click to trigger `showPicker()` or `click()` on `#date-picker-input`.
  - Handle `#live-filter-btn` click to toggle `active` class, update `isLiveFilterActive`, and update filters.
  In the input/change event listeners:
  - Keep `currentSearchQuery` updated when `#match-search` receives input.
  - Handle `change` event on `#date-picker-input` to update selected date and refresh.

- [ ] **Step 4: Commit the shell-entry event binding modifications**
  Check `auto_commit` setting. If true, stage and commit:
  ```bash
  git add apps/web/src/shell-entry.ts
  git commit -m "feat(web): bind date navigation and live filter events in shell-entry"
  ```

---

### Task 3: Unit Testing and Verification

**Files:**
- Modify: `apps/web/src/production-shell.test.ts`

- [ ] **Step 1: Add unit tests for the Date Navigator and LIVE filter**
  Add assertions to verify:
  - `renderAppShell({ activeTabId: 'matches' })` contains `#date-prev-btn`, `#date-next-btn`, `#date-picker-btn`, `#date-picker-input`, and `.date-chip` elements.
  - `#live-filter-btn` is rendered.
  - Helper functions format the 5 ribbon dates correctly.

- [ ] **Step 2: Run unit tests to verify they pass**
  Run: `pnpm --filter web test` or `npx vitest run apps/web/src/production-shell.test.ts`
  Expected: PASS

- [ ] **Step 3: Run the local verification suite**
  Run: `pnpm run verify:local`
  Expected: PASS with all type-safety and guardrail checks.

- [ ] **Step 4: Commit test updates**
  Check `auto_commit` setting. If true, stage and commit:
  ```bash
  git add apps/web/src/production-shell.test.ts
  git commit -m "test(web): add unit tests for date navigator and live filter UI"
  ```
