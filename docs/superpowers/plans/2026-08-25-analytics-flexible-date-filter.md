# Analytics Flexible Date Filter Implementation Plan (Single Range Calendar)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to filter Bankroll Analytics with quick presets (This Week, Previous Week, This Month, All) and a single interactive calendar picker for deep custom date ranges (Tap 1: Start date, Tap 2: End date, Tap again: Reset).

**Architecture:**
- Extend `BetReportPeriod` to support `'this_week' | 'previous_week' | 'this_month' | 'all' | 'custom'` with `startDate` and `endDate` boundaries.
- Build a lightweight, responsive single-calendar range picker in `bankroll-screen.ts` styled in `packages/ui/src/index.css`.
- Manage interactive range selection state (first tap selects start, second tap selects end, tapping an active date resets) and month navigation in `shell-entry.ts`.

**Tech Stack:** TypeScript, Node.js HTTP routes, CSS Grid/Flexbox, Vitest, Vanilla TS/HTML5 Web Components, Intl API.

---

## File Structure & Responsibilities

| File | Responsibility |
| :--- | :--- |
| `apps/api/src/services/bet-report-service.ts` | Aggregation service calculating date bounds for `previous_week`, `this_week`, `this_month`, `all`, and `custom` ranges. |
| `apps/api/src/services/bet-report-service.test.ts` | Unit tests for all preset and custom date period calculations and breakdowns. |
| `apps/api/src/routes/bet-reports.ts` | API route `/api/v1/bet-reports` validating `period`, `startDate`, `endDate`, `anchor`, and query params. |
| `apps/api/src/routes/bet-reports.test.ts` | Integration tests for route handling with `previous_week` and `custom` date ranges. |
| `apps/web/src/services/core-betting-service.ts` | Frontend client service for loading bet reports with custom range parameters. |
| `packages/ui/src/index.css` | Styles for the single range calendar component (grid, selection states, in-range highlights, month nav). |
| `apps/web/src/components/screens/bankroll-screen.ts` | UI rendering for preset segmented bar, single interactive range calendar, active range badge, and metrics. |
| `apps/web/src/shell-entry.ts` | Event handling for calendar taps (Tap 1 -> Start, Tap 2 -> End, Tap again -> Reset), month navigation, and report query. |
| `apps/web/src/locales/en.json` & `vi.json` | Localized labels for presets, calendar weekdays, month names, range hints, and apply button. |
| `apps/web/src/production-shell.test.ts` | Web UI regression tests for preset tabs, single calendar interactions, and custom filter queries. |

---

## Tasks

### Task 1: Backend Bet Report Service & Route for Presets and Custom Date Ranges

**Files:**
- Modify: `apps/api/src/services/bet-report-service.ts`
- Test: `apps/api/src/services/bet-report-service.test.ts`
- Modify: `apps/api/src/routes/bet-reports.ts`
- Test: `apps/api/src/routes/bet-reports.test.ts`

- [ ] **Step 1: Write the failing unit tests in `bet-report-service.test.ts`**

```ts
// apps/api/src/services/bet-report-service.test.ts
it('aggregates the previous week when period is previous_week', () => {
  const bets = [
    bet('prev1', 'full_win', 10, '2026-08-11T01:00:00.000Z', 'calm'),
    bet('this1', 'full_win', 10, '2026-08-18T01:00:00.000Z', 'calm')
  ];
  const events = [
    event('e1', 'prev1', 'full_win', 10, '2026-08-11T01:00:00.000Z'),
    event('e2', 'this1', 'full_win', 10, '2026-08-18T01:00:00.000Z')
  ];
  const report = buildBetReport({
    period: 'previous_week',
    anchor: '2026-08-21',
    timeZone: 'Asia/Tokyo',
    weekStartDay: 'monday',
    bets,
    events
  });
  expect(report.period).toMatchObject({
    kind: 'previous_week',
    startDate: '2026-08-10',
    endDate: '2026-08-16'
  });
  expect(report.totalSettledBets).toBe(1);
  expect(report.netProfitLossPoints).toBe(10);
});

it('aggregates custom date range when period is custom', () => {
  const bets = [
    bet('b1', 'full_win', 10, '2026-08-05T01:00:00.000Z', 'calm'),
    bet('b2', 'full_win', 15, '2026-08-12T01:00:00.000Z', 'calm'),
    bet('b3', 'full_win', 20, '2026-08-20T01:00:00.000Z', 'calm')
  ];
  const events = [
    event('e1', 'b1', 'full_win', 10, '2026-08-05T01:00:00.000Z'),
    event('e2', 'b2', 'full_win', 15, '2026-08-12T01:00:00.000Z'),
    event('e3', 'b3', 'full_win', 20, '2026-08-20T01:00:00.000Z')
  ];
  const report = buildBetReport({
    period: 'custom',
    customRange: { startDate: '2026-08-05', endDate: '2026-08-15' },
    anchor: '2026-08-21',
    timeZone: 'Asia/Tokyo',
    bets,
    events
  });
  expect(report.period).toMatchObject({
    kind: 'custom',
    startDate: '2026-08-05',
    endDate: '2026-08-15'
  });
  expect(report.totalSettledBets).toBe(2);
  expect(report.netProfitLossPoints).toBe(25);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/api/src/services/bet-report-service.test.ts`
Expected: FAIL with missing period handling.

- [ ] **Step 3: Implement period calculations in `bet-report-service.ts` and `bet-reports.ts`**

Update `BetReportPeriod`:
```ts
export type BetReportPeriod = 'week' | 'this_week' | 'previous_week' | 'month' | 'this_month' | 'previous_month' | 'all' | 'custom';
```
Update `bounds` function:
```ts
const bounds = (
  period: BetReportPeriod,
  anchor: string,
  weekStartDay: 'monday' | 'sunday' = 'monday',
  customRange?: { startDate: string; endDate: string }
) => {
  if (period === 'week' || period === 'this_week') {
    const startDate = weekStart(anchor, weekStartDay);
    return { startDate, endDate: addDays(startDate, 6) };
  }
  if (period === 'previous_week') {
    const currentWeekStart = weekStart(anchor, weekStartDay);
    const startDate = addDays(currentWeekStart, -7);
    return { startDate, endDate: addDays(startDate, 6) };
  }
  if (period === 'month' || period === 'this_month') {
    return monthBounds(anchor);
  }
  if (period === 'previous_month') {
    return monthBounds(anchor, -1);
  }
  if (period === 'custom' && customRange) {
    return { startDate: customRange.startDate, endDate: customRange.endDate };
  }
  return { startDate: null, endDate: null };
};
```
In `apps/api/src/routes/bet-reports.ts`:
Support `period=custom&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`, `period=previous_week`, etc., validating `startDate <= endDate` format.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run apps/api/src/services/bet-report-service.test.ts apps/api/src/routes/bet-reports.test.ts`
Expected: PASS

- [ ] **Step 5: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.
```bash
git add apps/api/src/services/bet-report-service.ts apps/api/src/services/bet-report-service.test.ts apps/api/src/routes/bet-reports.ts apps/api/src/routes/bet-reports.test.ts
git commit -m "feat: support previous week and custom date range in bet reports"
```

---

### Task 2: Web Client Service & State for Single Range Calendar Filtering

**Files:**
- Modify: `apps/web/src/services/core-betting-service.ts`
- Test: `apps/web/src/services/core-betting-service.test.ts`
- Modify: `apps/web/src/shell-entry.ts`

- [ ] **Step 1: Write unit test in `core-betting-service.test.ts` for custom range queries**

```ts
it('loads bet report with custom date range', async () => {
  let requestedUrl = '';
  const fetcher = async (url: string) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => ({
        period: { kind: 'custom', startDate: '2026-08-01', endDate: '2026-08-15', timeZone: 'UTC' },
        netProfitLossPoints: 0,
        totalSettledBets: 0,
        totalStakePoints: 0,
        averageStakePoints: 0,
        winRatePercent: 0,
        outcomes: {},
        daily: [],
        market: {},
        psychology: { emotion: {}, motivation: {}, planAdherence: {} },
        disciplineOverrideCount: 0
      })
    } as Response;
  };
  await loadBetReport({ period: 'custom', anchor: '2026-08-21', startDate: '2026-08-01', endDate: '2026-08-15' }, fetcher as never);
  expect(requestedUrl).toContain('period=custom');
  expect(requestedUrl).toContain('startDate=2026-08-01');
  expect(requestedUrl).toContain('endDate=2026-08-15');
});
```

- [ ] **Step 2: Update `loadBetReport` and `BetReportPeriod` in `core-betting-service.ts`**

Update `BetReportPeriod` and `loadBetReport`:
```ts
export type BetReportPeriod = 'this_week' | 'previous_week' | 'this_month' | 'all' | 'custom' | 'week' | 'month' | 'previous_month';

export async function loadBetReport(
  input: {
    readonly period: BetReportPeriod;
    readonly anchor: string;
    readonly startDate?: string;
    readonly endDate?: string;
    readonly accountId?: string;
  },
  fetcher: FetchLike = fetch
): Promise<BetReport> {
  const query = new URLSearchParams({ period: input.period, anchor: input.anchor });
  if (input.startDate) query.set('startDate', input.startDate);
  if (input.endDate) query.set('endDate', input.endDate);
  if (input.accountId) query.set('accountId', input.accountId);
  const response = await requireOk(await fetcher(buildApiUrl(`/api/v1/bet-reports?${query.toString()}`)));
  return response.json() as Promise<BetReport>;
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm vitest run apps/web/src/services/core-betting-service.test.ts`
Expected: PASS

- [ ] **Step 4: Commit (if auto_commit enabled)**

```bash
git add apps/web/src/services/core-betting-service.ts apps/web/src/services/core-betting-service.test.ts
git commit -m "feat: support custom range in client bet report service"
```

---

### Task 3: Single Range Calendar UI, CSS, Localization & Interaction Wiring

**Files:**
- Modify: `packages/ui/src/index.css`
- Modify: `apps/web/src/components/screens/bankroll-screen.ts`
- Modify: `apps/web/src/locales/en.json`
- Modify: `apps/web/src/locales/vi.json`
- Modify: `apps/web/src/shell-entry.ts`
- Test: `apps/web/src/production-shell.test.ts`

- [ ] **Step 1: Add single calendar styles to `packages/ui/src/index.css`**

Add styling for:
- `.calendar-picker`: Container with dark surface background and smooth border radius.
- `.cal-header`: Month title and previous/next navigation buttons.
- `.cal-weekdays`: 7-column weekday headers (T2–CN or Mon–Sun).
- `.cal-grid`: 7-column calendar day cells.
- `.cal-day`: Base day button.
- `.cal-day.selected-start`: Start date badge with primary blue highlight and rounded start edge.
- `.cal-day.selected-end`: End date badge with primary blue highlight and rounded end edge.
- `.cal-day.in-range`: Intermediate days with soft translucent accent background.
- `.cal-actions`: Range status text and `[Áp dụng]` button.

- [ ] **Step 2: Update localizations in `en.json` and `vi.json`**

In `en.json`:
```json
  "bankroll.thisWeek": "This Week",
  "bankroll.previousWeek": "Previous Week",
  "bankroll.thisMonth": "This Month",
  "bankroll.allTime": "All Time",
  "bankroll.customRange": "Custom",
  "bankroll.selectStartDate": "Tap to select start date",
  "bankroll.selectEndDate": "Tap to select end date",
  "bankroll.rangeSelected": "Selected: {start} to {end} ({days} days)",
  "bankroll.applyFilter": "Apply",
  "bankroll.prevMonth": "Previous month",
  "bankroll.nextMonth": "Next month",
```

In `vi.json`:
```json
  "bankroll.thisWeek": "Tuần này",
  "bankroll.previousWeek": "Tuần trước",
  "bankroll.thisMonth": "Tháng này",
  "bankroll.allTime": "Tất cả",
  "bankroll.customRange": "Tùy chỉnh",
  "bankroll.selectStartDate": "Chạm để chọn ngày bắt đầu",
  "bankroll.selectEndDate": "Chạm để chọn ngày kết thúc",
  "bankroll.rangeSelected": "Đã chọn: {start} đến {end} ({days} ngày)",
  "bankroll.applyFilter": "Áp dụng",
  "bankroll.prevMonth": "Tháng trước",
  "bankroll.nextMonth": "Tháng sau",
```

- [ ] **Step 3: Implement single calendar generator in `bankroll-screen.ts`**

In `bankroll-screen.ts`:
- Render 5 preset buttons: `this_week`, `previous_week`, `this_month`, `all`, `custom`.
- When `selectedPeriod === 'custom'`, render the interactive single-month calendar:
  - Generate month grid for current viewing month (`customCalendarMonth: 'YYYY-MM'`).
  - Render each day cell with data attributes (`data-cal-date="YYYY-MM-DD"`).
  - Apply CSS classes: `selected-start`, `selected-end`, `in-range` based on `rangeStart` and `rangeEnd`.
  - Render Range summary text and `[Áp dụng]` button (disabled when no start date is selected).

- [ ] **Step 4: Wire single calendar interactions in `shell-entry.ts`**

In `shell-entry.ts`:
- Track state: `customCalendarMonth` (`YYYY-MM`), `customRangeStart` (`YYYY-MM-DD | null`), `customRangeEnd` (`YYYY-MM-DD | null`).
- Handle `[data-cal-date]` click:
  - If no start date: set `customRangeStart = clickedDate`, `customRangeEnd = null`.
  - If start date set and clicked on start date: **Reset** (`customRangeStart = null`, `customRangeEnd = null`).
  - If start date set and clicked on later date: set `customRangeEnd = clickedDate`.
  - If start date set and clicked on earlier date: set `customRangeStart = clickedDate`, `customRangeEnd = null`.
  - If both start and end set: if clicked on start or end, **Reset**; if clicked on any other date, set as new `customRangeStart = clickedDate`, `customRangeEnd = null`.
- Handle `[data-cal-nav="prev"]` and `[data-cal-nav="next"]` to change visible calendar month.
- Handle `[data-action="apply-custom-range"]`: Call `refreshReports()` with `period: 'custom'`, `startDate`, `endDate`.

- [ ] **Step 5: Write tests in `production-shell.test.ts`**

Verify preset buttons (`this_week`, `previous_week`, `this_month`, `all`, `custom`), single calendar rendering, day clicks, range highlighting, reset behavior, and catalog parity.

- [ ] **Step 6: Run tests to verify**

Run: `pnpm vitest run apps/web`
Expected: PASS

- [ ] **Step 7: Commit (if auto_commit enabled)**

```bash
git add packages/ui/src/index.css apps/web/src/components/screens/bankroll-screen.ts apps/web/src/locales/en.json apps/web/src/locales/vi.json apps/web/src/shell-entry.ts apps/web/src/production-shell.test.ts
git commit -m "feat: add single interactive range calendar filter to bankroll analytics"
```

---

## Verification Plan

### Automated Tests
- `pnpm vitest run apps/api` (all API route & service tests pass)
- `pnpm vitest run apps/web` (all UI & shell tests pass)
- `pnpm vitest run` (entire repository test suite passes)
- `pnpm build` (static build passes)

### Manual Verification
1. Navigate to **Bankroll > Analytics** tab.
2. Verify quick preset buttons: "Tuần này", "Tuần trước", "Tháng này", "Tất cả", "Tùy chỉnh".
3. Click "Tuần trước": Verify report metrics and chart bars aggregate for the previous week cycle (respecting Monday/Sunday start).
4. Click "Tùy chỉnh": Verify single calendar UI is displayed.
5. Tap 1st date (e.g. 05/08/2026): Cell highlights as start date.
6. Tap 2nd date (e.g. 15/08/2026): Days between 05 and 15 highlight as in-range.
7. Tap 05/08/2026 again: Selection resets cleanly.
8. Select range and click "Áp dụng": Report displays data strictly within chosen range.
