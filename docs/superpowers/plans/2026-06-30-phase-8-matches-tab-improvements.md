# Matches Tab Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Matches tab to support filtering (by league, time, competition type, gender, specific leagues, and LIVE matches), timezone settings, tap-to-open detail rows, date navigation, dynamic details API/UI fetching match score and events, and grouping matches by league.

**Architecture:** Extend settings service for timezone configurations, add a backend endpoint for match details and events, build rich timeline and detail rendering in the client, and create a slide-down filters panel.

**Tech Stack:** TypeScript, HTML5, Vanilla CSS, Vitest.

---

## Task 1: Timezone settings and display density in Settings Service

**Files:**
- Modify: `apps/web/src/services/settings-service.ts`
- Modify: `apps/web/src/components/app-shell.ts`
- Test: `apps/web/src/production-shell.test.ts`

- [ ] **Step 1: Write a failing test for timezone and display density settings**
  Add a test verifying that timezone is stored and retrieved correctly, and that the settings form can set it.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter web test`
- [ ] **Step 3: Update Settings Service**
  Modify `apps/web/src/services/settings-service.ts` to support timezone setting with values `'local' | 'UTC' | 'Asia/Ho_Chi_Minh'`.
- [ ] **Step 4: Update Kickoff Formatting in UI**
  Modify `formatKickoffTime` in `apps/web/src/components/app-shell.ts` to respect timezone setting.
- [ ] **Step 5: Verify tests pass**
  Run: `pnpm --filter web test`

---

## Task 2: Backend Match Detail and Events API

**Files:**
- Modify: `apps/api/src/providers/api-football-client.ts`
- Create: `apps/api/src/routes/match-detail.ts`
- Create: `apps/api/src/routes/match-detail.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write failing tests for match details route**
  Create `apps/api/src/routes/match-detail.test.ts` with tests for GET `/api/v1/matches/detail` ensuring it handles success, error, missing parameters, and mock fallback.
- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter api test`
- [ ] **Step 3: Implement client method**
  Add `fetchFixtureDetail(fixtureId: string)` in `apps/api/src/providers/api-football-client.ts`. Let it return realistic mock details when the API key is not set.
- [ ] **Step 4: Implement endpoint handler**
  Create `apps/api/src/routes/match-detail.ts` and register GET `/api/v1/matches/detail` in `apps/api/src/index.ts`.
- [ ] **Step 5: Verify backend tests pass**
  Run: `pnpm --filter api test`

---

## Task 3: Date Navigator and LIVE Filter UI

**Files:**
- Modify: `apps/web/src/components/app-shell.ts`
- Modify: `apps/web/src/shell-entry.ts`

- [ ] **Step 1: Implement date navigator in shell component**
  Add HTML structure for the horizontal date ribbon and a custom date-picker input in `app-shell.ts`.
- [ ] **Step 2: Implement LIVE filter toggle button**
  Add a `LIVE` toggle button next to the search input in the search row.
- [ ] **Step 3: Bind events in shell-entry**
  Add event listeners for the date navigation chips, arrows, native picker, and LIVE toggle button in `shell-entry.ts`. Reload matches when date changes, and filter locally on LIVE status.
- [ ] **Step 4: Verify UI compiles and runs**
  Run: `pnpm run verify:local`

---

## Task 4: Match Filters Panel UI

**Files:**
- Modify: `apps/web/src/components/app-shell.ts`
- Modify: `apps/web/src/shell-entry.ts`

- [ ] **Step 1: Add Filters panel HTML**
  Modify `app-shell.ts` to add the slide-down `.filter-panel` markup containing Sort/Group, Type, Gender, and League checklists.
- [ ] **Step 2: Implement Filter events in entry**
  Add listeners for filter changes in `shell-entry.ts`. Extract all unique leagues from current matches to dynamically populate the leagues checklist.
- [ ] **Step 3: Filter match lists dynamically**
  Filter matches feed based on Type (National/Club), Gender, and selected Leagues, in addition to search query and LIVE filters.
- [ ] **Step 4: Run local verification**
  Run: `pnpm run verify:local`

---

## Task 5: Click-to-open details, League Sectioning and Row cleanup

**Files:**
- Modify: `apps/web/src/components/app-shell.ts`
- Modify: `apps/web/src/shell-entry.ts`

- [ ] **Step 1: Restructure match row and remove Open button**
  Remove "Open" buttons. Add `data-open-match` and clickable styles to the entire row/card.
- [ ] **Step 2: Implement league grouping and remove sub-text**
  Group matches by league under section headers when sorting by league. Remove redundant sub-text from Not Started matches. Render score directly on row for finished matches.
- [ ] **Step 3: Render detailed match info and events timeline**
  When a row is clicked, fetch GET `/api/v1/matches/detail?id=...`, display status, venue, referee, halftime/fulltime scores, and event timeline in the Match Detail panel.
- [ ] **Step 4: Verify and verify staging build**
  Run: `pnpm run verify:local` and `pnpm run verify:staging`
