import { describe, expect, it, vi } from 'vitest';
import {
  PRODUCTION_NAVIGATION_TAB_IDS,
  getNavigationTabById,
  navigationTabs
} from './config/navigation-tabs.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderAppShell } from './components/app-shell.js';
import { renderBottomNavigation } from './components/bottom-navigation.js';
import { createSettingsService } from './services/settings-service.js';
import {
  createTranslator,
  formatDateTime,
  formatNumber,
  getCatalogKeys,
  resolveLocale,
  t
} from './services/i18n-service.js';
import { getTodayDateTileParts } from './components/app-shell.js';
import { renderSettlementTimeline } from './components/screens/bets-screen.js';
import {
  renderSkeletonMetrics,
  renderSkeletonBetRows,
  renderSkeletonMatchRows,
  renderSkeletonLedgerRows,
  renderSkeletonCard
} from './components/screens/screen-shared.js';



function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));

  return {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => {
      store.clear();
    }),
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key) ?? null : null)),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    })
  };
}

describe('production PWA shell configuration', () => {
  it('keeps each primary screen renderer outside the app shell monolith', () => {
    const appShell = readFileSync(fileURLToPath(new URL('./components/app-shell.ts', import.meta.url)), 'utf8');
    expect(appShell).not.toContain('function renderMatchesPanel');
    expect(readFileSync(fileURLToPath(new URL('./components/screens/matches-screen.ts', import.meta.url)), 'utf8')).toContain('export function renderMatchesScreen');
  });

  it('uses the accepted four-tab domain navigation backbone only', () => {
    expect(PRODUCTION_NAVIGATION_TAB_IDS).toEqual([
      'today',
      'matches',
      'bets',
      'bankroll'
    ]);
    expect(navigationTabs.map((tab) => tab.id)).toEqual(PRODUCTION_NAVIGATION_TAB_IDS);
    expect(navigationTabs).toHaveLength(4);
    expect(navigationTabs.map((tab) => tab.id)).not.toContain('settings');
    expect(navigationTabs.map((tab) => tab.id)).not.toContain('add');
  });

  it('looks up stable tab metadata without inventing routes', () => {
    expect(getNavigationTabById('bets')).toMatchObject({
      id: 'bets',
      labelKey: 'nav.bets'
    });
    expect(getNavigationTabById('settings')).toBeNull();
  });
});

describe('phase 9 cloud persistence workflows', () => {
  it('localizes settlement timeline values and formats audit timestamps in the configured timezone', () => {
    const html = renderSettlementTimeline([{ settlementEventId: 's1', ownerProfileId: 'owner-primary', betId: 'b1', bankrollAccountId: 'a', settlementType: 'full_win', planAdherence: 'yes', calculatedProfitLossPoints: 9, ledgerDeltaPoints: 9, effectiveAt: '2026-08-21T12:00:00.000Z', occurredAt: '2026-08-21T12:00:00.000Z' }], createTranslator('vi'), 'vi', 'Asia/Tokyo');
    expect(html).toContain('Thắng đủ');
    expect(html).not.toContain('full_win');
    expect(html).not.toContain('2026-08-21T12:00:00.000Z');
  });

  it('renders honest Bets loading, empty, unavailable, and durable record states', () => {
    expect(renderAppShell({ activeTabId: 'bets', betRecordsState: { status: 'loading' } })).toContain('data-bet-records-state="loading"');
    expect(renderAppShell({ activeTabId: 'bets', betRecordsState: { status: 'empty' } })).toContain('data-bet-records-state="empty"');
    const unavailable = renderAppShell({ activeTabId: 'bets', translate: createTranslator('vi'), betRecordsState: { status: 'unavailable', reason: 'Setup required' } });
    expect(unavailable).toContain('Không khả dụng');
    expect(unavailable).not.toContain('Setup required');
    const html = renderAppShell({ activeTabId: 'bets', betRecordFilter: 'drafts', betRecordsState: { status: 'ready', drafts: [{ draftId: 'd1', matchGroupId: 'm1', marketType: '1X2', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, createdAt: '2026-07-02T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z' }], pending: [{ betId: 'b1', ownerProfileId: 'owner-primary', matchGroupId: 'm1', homeTeamName: 'Japan', awayTeamName: 'Vietnam', marketType: '1X2', selectionLabel: 'Japan', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, status: 'pending', createdAt: '2026-07-02T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z' }], settled: [] } });
    expect(html).toContain('data-delete-draft-confirm="d1"');
    expect(html).not.toContain('data-bet-id="b1"');
  });

  it('renders only the selected Bets segment and exposes manual ongoing and settlement workflows', () => {
    const html = renderAppShell({
      activeTabId: 'bets',
      betRecordFilter: 'ongoing',
      bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 100, archived: false, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], ledger: [], summary: { realizedBalance: 100, openExposure: 10, availableBalance: 90, accounts: [] } },
      betRecordsState: { status: 'ready', drafts: [{ draftId: 'd1', matchGroupId: 'm1', marketType: '1X2', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], pending: [{ betId: 'b1', ownerProfileId: 'owner-primary', bankrollAccountId: 'a', matchGroupId: 'm1', homeTeamName: 'Japan', awayTeamName: 'Vietnam', marketType: '1X2', selectionLabel: 'Japan', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, preBetEmotion: 'calm', preBetMotivation: 'planned_analysis', status: 'pending', createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], settled: [] }
    });
    expect(html).toContain('data-bet-filter="ongoing"');
    expect(html).toContain('Japan vs Vietnam');
    expect(html).toContain('data-open-settlement="b1"');
    expect(html).not.toContain('data-delete-draft-confirm="d1"');
    expect(html).toContain('name="home-team"');
    expect(html).toContain('id="record-ongoing-bet"');
    expect(html).toContain('id="settlement-form"');
  });

  it('renders real bankroll summaries, discipline nulls, and report analytics without forbidden metrics', () => {
    const html = renderAppShell({
      activeTabId: 'bankroll', bankrollView: 'discipline',
      bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 90, archived: false, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], ledger: [], summary: { realizedBalance: 90, openExposure: 20, availableBalance: 70, accounts: [] } },
      disciplineConfigState: { status: 'ready', config: { ownerProfileId: 'owner-primary', dailyStopLossPoints: null, weeklyStopLossPoints: null, bigBetThresholdPoints: null, timeZone: 'Asia/Tokyo', cooldownSeconds: 15, version: 1, updatedAt: '2026-08-21T00:00:00.000Z' } }
    });
    expect(html).toContain('data-bankroll-view="discipline"');
    expect(html).toContain('value=""');
    expect(html).toContain('Discipline rules not configured');
    expect(html).toContain('id="discipline-week-start-day"');
    expect(html).not.toContain('id="discipline-timezone"');
    expect(html).not.toContain('yield');
    expect(html).not.toContain('ROI');
  });

  it('renders week start day selector and hint in discipline view for english and vietnamese', () => {
    const mondayHtml = renderAppShell({
      activeTabId: 'bankroll', bankrollView: 'discipline',
      bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 90, archived: false, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], ledger: [], summary: { realizedBalance: 90, openExposure: 20, availableBalance: 70, accounts: [] } },
      disciplineConfigState: { status: 'ready', config: { ownerProfileId: 'owner-primary', dailyStopLossPoints: null, weeklyStopLossPoints: null, bigBetThresholdPoints: null, timeZone: 'Asia/Tokyo', weekStartDay: 'monday', cooldownSeconds: 15, version: 1, updatedAt: '2026-08-21T00:00:00.000Z' } }
    });
    expect(mondayHtml).toContain('id="discipline-week-start-day"');
    expect(mondayHtml).toContain('<option value="monday" selected>Monday</option>');
    expect(mondayHtml).toContain('<option value="sunday">Sunday</option>');
    expect(mondayHtml).toContain('Daily and weekly limits reset at 00:00 in your App Settings timezone.');
    expect(mondayHtml).not.toContain('id="discipline-timezone"');

    const sundayHtml = renderAppShell({
      activeTabId: 'bankroll', bankrollView: 'discipline',
      translate: createTranslator('vi'),
      bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 90, archived: false, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], ledger: [], summary: { realizedBalance: 90, openExposure: 20, availableBalance: 70, accounts: [] } },
      disciplineConfigState: { status: 'ready', config: { ownerProfileId: 'owner-primary', dailyStopLossPoints: null, weeklyStopLossPoints: null, bigBetThresholdPoints: null, timeZone: 'Asia/Tokyo', weekStartDay: 'sunday', cooldownSeconds: 15, version: 1, updatedAt: '2026-08-21T00:00:00.000Z' } }
    });
    expect(sundayHtml).toContain('id="discipline-week-start-day"');
    expect(sundayHtml).toContain('Ngày bắt đầu tuần');
    expect(sundayHtml).toContain('<option value="monday">Thứ Hai</option>');
    expect(sundayHtml).toContain('<option value="sunday" selected>Chủ Nhật</option>');
    expect(sundayHtml).toContain('Mốc ngày và tuần được tính lúc 00:00 theo múi giờ Cài đặt ứng dụng.');
    expect(sundayHtml).not.toContain('id="discipline-timezone"');
  });

  it('localizes report enum labels, includes outcome counts, and keeps manual settlement fields hidden by default', () => {
    const html = renderAppShell({
      activeTabId: 'bankroll',
      bankrollView: 'analytics',
      translate: createTranslator('vi'),
      bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 109, archived: false, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], ledger: [], summary: { realizedBalance: 109, openExposure: 0, availableBalance: 109, accounts: [] } },
      reportState: { status: 'ready', report: { period: { kind: 'week', startDate: '2026-08-17', endDate: '2026-08-23', timeZone: 'Asia/Tokyo' }, netProfitLossPoints: 9, totalSettledBets: 1, totalStakePoints: 10, averageStakePoints: 10, winRatePercent: 100, outcomes: { full_win: 1 }, daily: [{ date: '2026-08-21', profitLossPoints: 9 }], market: { '1X2': { count: 1, profitLossPoints: 9 } }, psychology: { emotion: { calm: { count: 1, profitLossPoints: 9 } }, motivation: { planned_analysis: { count: 1, profitLossPoints: 9 } }, planAdherence: { yes: { count: 1, profitLossPoints: 9 } } }, disciplineOverrideCount: 1 } }
    });
    const css = readFileSync(fileURLToPath(new URL('../../../packages/ui/src/index.css', import.meta.url)), 'utf8');
    const bankrollPanel = html.slice(html.indexOf('id="screen-bankroll"'), html.indexOf('id="screen-match-detail"'));
    expect(html).toContain('Kết quả');
    expect(html).toContain('Thắng đủ');
    expect(html).toContain('Phân tích có kế hoạch');
    expect(bankrollPanel).not.toContain('planned_analysis');
    expect(css).toMatch(/\.field\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
  });

  it('renders bankroll analytics period presets in EN and VI with correct active highlights', () => {
    const enHtml = renderAppShell({
      activeTabId: 'bankroll',
      bankrollView: 'analytics',
      reportPeriod: 'previous_week',
      bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 100, archived: false, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], ledger: [], summary: { realizedBalance: 100, openExposure: 0, availableBalance: 100, accounts: [] } },
      reportState: { status: 'ready', report: { period: { kind: 'previous_week', startDate: '2026-08-10', endDate: '2026-08-16', timeZone: 'UTC' }, netProfitLossPoints: 0, totalSettledBets: 0, totalStakePoints: 0, averageStakePoints: 0, winRatePercent: 0, outcomes: {}, daily: [], market: {}, psychology: { emotion: {}, motivation: {}, planAdherence: {} }, disciplineOverrideCount: 0 } }
    });
    expect(enHtml).toContain('data-report-period="this_week"');
    expect(enHtml).toContain('data-report-period="previous_week"');
    expect(enHtml).toContain('data-report-period="this_month"');
    expect(enHtml).toContain('data-report-period="all"');
    expect(enHtml).toContain('data-report-period="custom"');
    expect(enHtml).toContain('This Week');
    expect(enHtml).toContain('Previous Week');
    expect(enHtml).toContain('This Month');
    expect(enHtml).toContain('All Time');
    expect(enHtml).toContain('Custom');
    expect(enHtml).toContain('<button class="active" type="button" data-report-period="previous_week">Previous Week</button>');
    expect(enHtml).toContain('class="report-range-badge">📅 2026-08-10 – 2026-08-16</div>');

    const viHtml = renderAppShell({
      activeTabId: 'bankroll',
      bankrollView: 'analytics',
      translate: createTranslator('vi'),
      locale: 'vi',
      reportPeriod: 'this_week',
      bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 100, archived: false, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], ledger: [], summary: { realizedBalance: 100, openExposure: 0, availableBalance: 100, accounts: [] } },
      reportState: { status: 'ready', report: { period: { kind: 'this_week', startDate: '2026-08-17', endDate: '2026-08-23', timeZone: 'UTC' }, netProfitLossPoints: 0, totalSettledBets: 0, totalStakePoints: 0, averageStakePoints: 0, winRatePercent: 0, outcomes: {}, daily: [], market: {}, psychology: { emotion: {}, motivation: {}, planAdherence: {} }, disciplineOverrideCount: 0 } }
    });
    expect(viHtml).toContain('Tuần này');
    expect(viHtml).toContain('Tuần trước');
    expect(viHtml).toContain('Tháng này');
    expect(viHtml).toContain('Tất cả');
    expect(viHtml).toContain('Tùy chỉnh');
    expect(viHtml).toContain('<button class="active" type="button" data-report-period="this_week">Tuần này</button>');
    expect(viHtml).toContain('class="report-range-badge">📅 2026-08-17 – 2026-08-23</div>');
  });

  it('renders single interactive calendar picker for custom date filtering with range highlights and status hint', () => {
    // 1. Initial custom view without selection (in August 2026)
    const emptyCalendarHtml = renderAppShell({
      activeTabId: 'bankroll',
      bankrollView: 'analytics',
      reportPeriod: 'custom',
      customCalendarMonth: '2026-08',
      bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 100, archived: false, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], ledger: [], summary: { realizedBalance: 100, openExposure: 0, availableBalance: 100, accounts: [] } },
      reportState: { status: 'empty' }
    });
    expect(emptyCalendarHtml).toContain('class="calendar-picker"');
    expect(emptyCalendarHtml).toContain('data-cal-nav="prev"');
    expect(emptyCalendarHtml).toContain('data-cal-nav="next"');
    expect(emptyCalendarHtml).toContain('August 2026');
    expect(emptyCalendarHtml).toContain('data-cal-date="2026-08-01"');
    expect(emptyCalendarHtml).toContain('data-cal-date="2026-08-31"');
    expect(emptyCalendarHtml).toContain('Tap to select start date');
    expect(emptyCalendarHtml).toContain('data-action="apply-custom-range" disabled');

    // 2. Start date selected only
    const startOnlyHtml = renderAppShell({
      activeTabId: 'bankroll',
      bankrollView: 'analytics',
      reportPeriod: 'custom',
      customCalendarMonth: '2026-08',
      customRangeStart: '2026-08-05',
      bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 100, archived: false, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], ledger: [], summary: { realizedBalance: 100, openExposure: 0, availableBalance: 100, accounts: [] } },
      reportState: { status: 'empty' }
    });
    expect(startOnlyHtml).toContain('class="cal-day selected-start" data-cal-date="2026-08-05"');
    expect(startOnlyHtml).toContain('From 2026-08-05 (Tap to select end date)');
    expect(startOnlyHtml).not.toContain('data-action="apply-custom-range" disabled');

    // 3. Full range selected with in-range days in Vietnamese
    const rangeHtml = renderAppShell({
      activeTabId: 'bankroll',
      bankrollView: 'analytics',
      translate: createTranslator('vi'),
      locale: 'vi',
      reportPeriod: 'custom',
      customCalendarMonth: '2026-08',
      customRangeStart: '2026-08-05',
      customRangeEnd: '2026-08-10',
      bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 100, archived: false, createdAt: '2026-08-21T00:00:00.000Z', updatedAt: '2026-08-21T00:00:00.000Z' }], ledger: [], summary: { realizedBalance: 100, openExposure: 0, availableBalance: 100, accounts: [] } },
      reportState: { status: 'ready', report: { period: { kind: 'custom', startDate: '2026-08-05', endDate: '2026-08-10', timeZone: 'UTC' }, netProfitLossPoints: 15, totalSettledBets: 2, totalStakePoints: 20, averageStakePoints: 10, winRatePercent: 100, outcomes: { full_win: 2 }, daily: [{ date: '2026-08-06', profitLossPoints: 15 }], market: { '1X2': { count: 2, profitLossPoints: 15 } }, psychology: { emotion: { calm: { count: 2, profitLossPoints: 15 } }, motivation: { planned_analysis: { count: 2, profitLossPoints: 15 } }, planAdherence: { yes: { count: 2, profitLossPoints: 15 } } }, disciplineOverrideCount: 0 } }
    });
    expect(rangeHtml).toContain('class="cal-day selected-start" data-cal-date="2026-08-05"');
    expect(rangeHtml).toContain('class="cal-day in-range" data-cal-date="2026-08-06"');
    expect(rangeHtml).toContain('class="cal-day in-range" data-cal-date="2026-08-07"');
    expect(rangeHtml).toContain('class="cal-day in-range" data-cal-date="2026-08-08"');
    expect(rangeHtml).toContain('class="cal-day in-range" data-cal-date="2026-08-09"');
    expect(rangeHtml).toContain('class="cal-day selected-end" data-cal-date="2026-08-10"');
    expect(rangeHtml).toContain('Từ 2026-08-05 đến 2026-08-10 (6 ngày)');
    expect(rangeHtml).toContain('class="report-range-badge">📅 2026-08-05 – 2026-08-10</div>');
  });

  it('verifies calendar interaction logic and reset mechanics in shell-entry.ts source', () => {
    const shellSource = readFileSync(fileURLToPath(new URL('./shell-entry.ts', import.meta.url)), 'utf8');
    expect(shellSource).toContain('[data-cal-nav]');
    expect(shellSource).toContain('[data-cal-date]');
    expect(shellSource).toContain('[data-action="apply-custom-range"]');
    expect(shellSource).toContain('customRangeStart = null');
    expect(shellSource).toContain('customRangeEnd = null');
  });

  it('keeps manual Add Bet available when the match feed is unavailable', () => {
    const html = renderAppShell({ activeTabId: 'matches', matchFeed: { status: 'unavailable', date: '2026-08-21', reason: 'offline', warnings: [], snapshot: { snapshotId: 's', generatedAt: '2026-08-21T00:00:00.000Z', importedAt: '2026-08-21T00:00:00.000Z', matchCount: 0, competitions: [], sources: [], freshness: 'missing', warnings: [] } } });
    expect(html).toContain('data-open-manual-add');
    expect(html).toContain('Manual Add Bet');
  });

  it('renders the Matches screen and contextual detail shell from the VI catalog', () => {
    const html = renderAppShell({ activeTabId: 'matches', translate: createTranslator('vi'), isFilterPanelOpen: true, matchFeed: { status: 'empty', date: '2026-08-21', warnings: [], snapshot: { snapshotId: 's', generatedAt: '2026-08-21T00:00:00.000Z', importedAt: '2026-08-21T00:00:00.000Z', matchCount: 0, competitions: [], sources: [], freshness: 'fresh', warnings: [] } } });
    expect(html).toContain('Sắp xếp &amp; nhóm');
    expect(html).toContain('Loại giải đấu');
    expect(html).toContain('Không có trận đấu');
    expect(html).toContain('Trận đã chọn');
    expect(html).not.toContain('Search generic teams');
    expect(html).not.toContain('Selected match');
    expect(html).toContain('aria-label="Điều hướng chính"');
    expect(html).toContain('Trên / Dưới');
    expect(html).not.toContain('Over / Under');
    expect(html).not.toContain('2026-08-21T00:00:00.000Z');
    expect(html).toContain('aria-label="Chọn ngày" tabindex="-1"');
  });

  it('renders persisted Bankroll without formula placeholders', () => {
    const html = renderAppShell({ activeTabId: 'bankroll', bankrollView: 'ledger', bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 90, archived: false, createdAt: '2026-07-02T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z' }], ledger: [{ entryId: 'e', ownerProfileId: 'owner-primary', accountId: 'a', entryType: 'withdrawal', amountPoints: -10, occurredAt: '2026-07-02T00:00:00.000Z', createdAt: '2026-07-02T00:00:00.000Z' }], summary: { realizedBalance: 90, openExposure: 0, availableBalance: 90, accounts: [] } } });
    expect(html).toContain('90 pts');
    expect(html).toContain('data-ledger-type="deposit"');
    expect(html).toContain('data-ledger-type="withdrawal"');
    expect(html).toContain('data-open-transfer');
    expect(html).toContain('data-ledger-type="correction"');
    expect(html).not.toContain('24,500 pts');
    expect(html).not.toContain('Formula status');
    expect(html).toContain('id="ledger-adjustment-form"');
    expect(html).not.toContain('2026-07-02T00:00:00.000Z');
    const shellEntry = readFileSync(fileURLToPath(new URL('./shell-entry.ts', import.meta.url)), 'utf8');
    expect(shellEntry).not.toContain('window.prompt');
    expect(shellEntry).toContain("form.get('weekStartDay')");
    expect(shellEntry).toContain('settingsService.getSettings()');
  });
});

describe('production PWA shell rendering', () => {
  it('renders the production app shell with bottom navigation and all tab panels', () => {
    const html = renderAppShell({ activeTabId: 'today', translate: t });

    expect(html).toContain('data-production-shell="phase-5-9"');
    expect(html).toContain('data-production-baseline="black-apple-ledger"');
    expect(html).toContain('data-shell-tab-panel="today"');
    expect(html).toContain('data-shell-tab-panel="matches"');
    expect(html).toContain('data-shell-tab-panel="bets"');
    expect(html).toContain('data-shell-tab-panel="bankroll"');
    expect(html).not.toContain('data-shell-tab-panel="miraichi"');
    expect(html).not.toContain('data-settings-entry="miraichi-tab"');
    expect(html).not.toContain('data-primary-tab="settings"');
    expect(html).not.toContain('data-primary-tab="add"');
  });

  it('keeps production aligned with the accepted Black Apple Ledger shell structure', () => {
    const html = renderAppShell({
      activeTabId: 'today',
      translate: t,
      matchFeed: {
        status: 'ready',
        date: '2026-06-29',
        warnings: [],
        snapshot: {
          snapshotId: 'test-snapshot',
          generatedAt: '2026-07-01T00:00:00.000Z',
          importedAt: '2026-07-01T00:00:00.000Z',
          matchCount: 1,
          competitions: [],
          sources: [],
          freshness: 'fresh' as const,
          warnings: []
        },
        matches: [
          {
            id: 'match-1',
            competition: {
              id: 'world-cup-2026',
              name: 'FIFA World Cup',
              type: 'national-team',
              season: '2026'
            },
            kickoffUtc: '2026-06-29T10:00:00.000Z',
            status: 'scheduled',
            homeTeam: { id: 'team-1', name: 'Japan' },
            awayTeam: { id: 'team-2', name: 'Vietnam' },
            score: { home: null, away: null },
            venue: 'Tokyo Stadium',
            sourceRefs: [],
            updatedAt: '2026-07-01T00:00:00.000Z'
          }
        ]
      }
    });

    expect(html).not.toContain('class="top-bar"');
    expect(html).not.toContain('class="notice"');
    expect(html).toContain('class="main-scroll"');
    expect(html).toContain('class="screen active" id="screen-today"');
    expect(html).toContain('class="metric-grid"');
    expect(html).toContain('data-open-manual-add');
    expect(html).toContain('id="screen-match-detail"');
    expect(html).toContain('data-open-match');
    expect(html).toContain('data-open-scoped-add');
    expect(html).toContain('data-bet-records-state');
    expect(html).toContain('class="sheet-backdrop"');
    expect(html).toContain('class="sheet" id="add-sheet"');
    expect(html).toContain('id="match-summary-readonly"');
    expect(html).not.toContain('id="match-field"');
    expect(html).not.toContain('data-primary-add');
  });

  it('renders the current date in the Today header without phase labels', () => {
    const html = renderAppShell({ activeTabId: 'today', translate: t });
    const today = getTodayDateTileParts();

    expect(html).toContain('Today command center');
    expect(today.day).toMatch(/^\d{1,2}$/);
    expect(today.month).toMatch(/^[A-Z]{3}$/);
    expect(html).not.toContain('5.9');
    expect(html).not.toContain('PWA</span>');
  });

  it('removes the redundant choose-match-to-add action from the Bets tab', () => {
    const html = renderAppShell({ activeTabId: 'bets', translate: t });

    expect(html).not.toContain('Choose Match to Add');
  });

  it('does not render detail copy under primary tab titles', () => {
    const html = renderAppShell({ activeTabId: 'today', translate: t });

    expect(html).not.toContain('Quick snapshot for points, matches, and market context.');
    expect(html).not.toContain('Generic fixtures grouped for manual tracking.');
    expect(html).not.toContain('Manage ongoing, draft, and settled mock records.');
    expect(html).not.toContain('Static point snapshot for layout review.');
    expect(html).not.toContain('Context inbox for future review workflows.');
  });

  it('keeps production as the only served web shell route', () => {
    const serverSource = readFileSync(fileURLToPath(new URL('./index.ts', import.meta.url)), 'utf8');

    expect(serverSource).not.toContain('/preview');
    expect(serverSource).not.toContain('preview.html');
  });

  it('serves browser-imported config package modules in dev and static builds', () => {
    const serverSource = readFileSync(fileURLToPath(new URL('./index.ts', import.meta.url)), 'utf8');
    const staticBuildSource = readFileSync(fileURLToPath(new URL('../scripts/build-static.ts', import.meta.url)), 'utf8');
    const serviceWorkerSource = readFileSync(fileURLToPath(new URL('../public/service-worker.ts', import.meta.url)), 'utf8');

    expect(serverSource).toContain("url.startsWith('/packages/config/src/')");
    expect(serverSource).toContain('function resolveSourcePath');
    expect(serverSource).toContain('filePath = resolveSourcePath(url);');
    expect(staticBuildSource).toContain("'packages/config/src'");
    expect(serviceWorkerSource).toContain('/packages/config/src/competition-registry.mock.js');
  });

  it('renders accessible bottom navigation buttons with the active tab marked', () => {
    const html = renderBottomNavigation({
      activeTabId: 'bets',
      tabs: navigationTabs,
      translate: t
    });

    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('type="button"');
    expect(html).toContain('class="nav-item active"');
    expect(html).toContain('data-tab-target="bets"');
    expect(html).toContain('data-screen="bets"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Bets');
  });

  it('uses a stadium-style icon for the Matches tab', () => {
    const html = renderBottomNavigation({
      activeTabId: 'matches',
      tabs: navigationTabs,
      translate: t
    });

    expect(html).toContain('data-icon="stadium"');
  });

  it('renders the Date Navigator without a match-feed LIVE filter', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'ready',
        date: '2026-06-30',
        warnings: [],
        snapshot: {
          snapshotId: 'test-snapshot',
          generatedAt: '2026-07-01T00:00:00.000Z',
          importedAt: '2026-07-01T00:00:00.000Z',
          matchCount: 0,
          competitions: [],
          sources: [],
          freshness: 'fresh' as const,
          warnings: []
        },
        matches: []
      }
    });

    expect(html).toContain('id="date-prev-btn"');
    expect(html).toContain('id="date-next-btn"');
    expect(html).toContain('id="date-picker-btn"');
    expect(html).toContain('id="date-picker-input"');
    expect(html).toContain('class="date-ribbon"');
    
    // It should render 5 dates centered around 2026-06-30:
    // 2026-06-28, 2026-06-29, 2026-06-30, 2026-07-01, 2026-07-02
    expect(html).toContain('data-date="2026-06-28"');
    expect(html).toContain('data-date="2026-06-29"');
    expect(html).toContain('data-date="2026-06-30"');
    expect(html).toContain('data-date="2026-07-01"');
    expect(html).toContain('data-date="2026-07-02"');

    // The center date should be active
    expect(html).toContain('class="date-chip active" type="button" data-date="2026-06-30"');

    expect(html).not.toContain('id="live-filter-btn"');
    expect(html).not.toContain('>LIVE</button>');
  });
});

describe('production shell settings and i18n boundaries', () => {
  it('detects Vietnamese from browser locale and otherwise falls back to English', () => {
    expect(resolveLocale({ navigatorLanguages: ['vi-VN', 'en-US'] })).toBe('vi');
    expect(resolveLocale({ navigatorLanguages: ['ja-JP'] })).toBe('en');
    expect(resolveLocale({ storedLocale: 'en', navigatorLanguages: ['vi-VN'] })).toBe('en');
  });

  it('defaults the product to English until the owner explicitly changes locale', () => {
    const storage = createMemoryStorage();
    const settings = createSettingsService({ storage, navigatorLanguages: ['vi-VN'] });

    expect(settings.getSettings()).toMatchObject({
      locale: 'en',
      theme: 'dark',
      displayDensity: 'standard'
    });

    settings.setSetting('locale', 'vi');
    expect(settings.getSettings().locale).toBe('vi');

    expect(() => settings.setSetting('bettingHistory', [])).toThrow(
      'Unsupported shell setting key: bettingHistory'
    );
    expect(storage.setItem).not.toHaveBeenCalledWith(
      expect.stringContaining('betting-history'),
      expect.any(String)
    );
  });

  it('keeps EN and VI catalogs in parity and resolves named placeholders', () => {
    expect(getCatalogKeys('en')).toEqual(getCatalogKeys('vi'));
    expect(createTranslator('en')('bets.count', { count: 2 })).toBe('2 bets');
    expect(createTranslator('vi')('bets.count', { count: 2 })).toBe('2 cược');
    expect(t('nav.today', 'Today')).toBe('Today');
    expect(createTranslator('vi')('settings.language')).toBe('Ngôn ngữ');
  });

  it('formats numbers and dates through locale-aware Intl helpers', () => {
    expect(formatNumber(1234.5, 'en', { maximumFractionDigits: 1 })).toBe('1,234.5');
    expect(formatNumber(1234.5, 'vi', { maximumFractionDigits: 1 })).toContain('1.234,5');
    expect(formatDateTime('2026-08-21T10:00:00.000Z', 'en', 'UTC')).toContain('Aug');
  });

  it('supports timezone and display density settings', () => {
    const storage = createMemoryStorage();
    const settings = createSettingsService({ storage });

    // Verify defaults
    expect(settings.getSettings()).toMatchObject({
      timezone: 'local',
      displayDensity: 'standard'
    });

    // Test settings.setSetting('timezone', 'UTC')
    settings.setSetting('timezone', 'UTC');
    expect(settings.getSettings().timezone).toBe('UTC');

    // Test settings.setSetting('timezone', 'Asia/Ho_Chi_Minh')
    settings.setSetting('timezone', 'Asia/Ho_Chi_Minh');
    expect(settings.getSettings().timezone).toBe('Asia/Ho_Chi_Minh');

    // Verify invalid values are rejected
    expect(() => settings.setSetting('timezone', 'invalid-timezone')).toThrow();

    // Verify displayDensity works as well
    settings.setSetting('displayDensity', 'compact');
    expect(settings.getSettings().displayDensity).toBe('compact');

    expect(() => settings.setSetting('displayDensity', 'invalid-density')).toThrow();

    // Verify settings sheet renders timezone select
    const html = renderAppShell({ translate: t });
    expect(html).toContain('id="settings-timezone"');
    expect(html).toContain('name="timezone"');
    expect(html).toContain('value="local"');
    expect(html).toContain('value="UTC"');
    expect(html).toContain('value="Asia/Ho_Chi_Minh"');
  });

  it('respects timezone settings when rendering kickoff times in app shell', () => {
    const matchFeed = {
      status: 'ready' as const,
      date: '2026-06-29',
      warnings: [] as string[],
      snapshot: {
        snapshotId: 'test-snapshot',
        generatedAt: '2026-07-01T00:00:00.000Z',
        importedAt: '2026-07-01T00:00:00.000Z',
        matchCount: 1,
        competitions: [],
        sources: [],
        freshness: 'fresh' as const,
        warnings: []
      },
      matches: [
        {
          id: 'test-fixture-1',
          competition: {
            id: 'test-league',
            name: 'FIFA World Cup',
            type: 'national-team' as const,
            season: '2026'
          },
          kickoffUtc: '2026-06-29T10:00:00.000Z',
          status: 'scheduled' as const,
          homeTeam: { id: 'team-1', name: 'Japan' },
          awayTeam: { id: 'team-2', name: 'Vietnam' },
          score: { home: null, away: null },
          updatedAt: '2026-07-01T00:00:00.000Z',
          sourceRefs: []
        }
      ]
    };

    // For UTC timezone
    const htmlUtc = renderAppShell({
      activeTabId: 'today',
      translate: t,
      matchFeed,
      timezone: 'UTC'
    });
    expect(htmlUtc).toContain('Kickoff 10:00 UTC');

    // For Asia/Ho_Chi_Minh timezone (UTC+7)
    const htmlHcm = renderAppShell({
      activeTabId: 'today',
      translate: t,
      matchFeed,
      timezone: 'Asia/Ho_Chi_Minh'
    });
    expect(htmlHcm).toContain('Kickoff 17:00 Asia/Ho_Chi_Minh');
  });
});

describe('production shell match snapshot rendering', () => {
  it('renders loading and unavailable states for serving match feed', () => {
    const loadingHtml = renderAppShell({
      activeTabId: 'today',
      translate: t,
      matchFeed: { status: 'loading', date: '2026-06-29' }
    });
    expect(loadingHtml).toContain('Loading match store');

    const unavailableHtml = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'unavailable',
        date: '2026-06-29',
        reason: 'Serving match store is missing. Build it from canonical warehouse before using match workflows.',
        warnings: ['serving_match_store_missing']
      }
    });
    expect(unavailableHtml).toContain('Data update required');
    expect(unavailableHtml).toContain('Data status: Unavailable');
    expect(unavailableHtml).toContain('Match feed unavailable. Manual bet entry is still available.');
    expect(unavailableHtml).not.toContain('Build it from canonical warehouse');

    const missingSnapshotHtml = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'unavailable',
        date: '2026-06-29',
        reason: 'Match snapshot is unavailable.',
        warnings: ['cloud_match_snapshot_missing'],
        snapshot: {
          snapshotId: 'cloud-missing',
          generatedAt: '2026-08-02T00:00:00.000Z',
          importedAt: '2026-08-02T00:00:00.000Z',
          matchCount: 0,
          competitions: [],
          sources: [],
          freshness: 'missing',
          warnings: ['Cloud match snapshot is unavailable.']
        }
      }
    });
    expect(missingSnapshotHtml).toContain('Data status: Unavailable');
    expect(missingSnapshotHtml).not.toContain('No matches found');
    expect(missingSnapshotHtml).not.toContain('Snapshot generated:');
  });

  it('renders serving store matches and removes visible hardcoded live feed labels', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'ready',
        date: '2026-06-29',
        warnings: [],
        snapshot: {
          snapshotId: 'test-snapshot',
          generatedAt: '2026-07-01T00:00:00.000Z',
          importedAt: '2026-07-01T00:00:00.000Z',
          matchCount: 1,
          competitions: [],
          sources: [],
          freshness: 'fresh' as const,
          warnings: []
        },
        matches: [
          {
            id: 'match-1',
            competition: {
              id: 'world-cup-2026',
              name: 'FIFA World Cup',
              type: 'national-team',
              season: '2026'
            },
            kickoffUtc: '2026-06-29T10:00:00.000Z',
            status: 'scheduled',
            homeTeam: { id: 'team-1', name: 'Japan' },
            awayTeam: { id: 'team-2', name: 'Vietnam' },
            score: { home: null, away: null },
            venue: 'Tokyo Stadium',
            sourceRefs: [],
            updatedAt: '2026-07-01T00:00:00.000Z'
          }
        ]
      }
    });

    expect(html).toContain('Japan vs Vietnam');
    expect(html).toContain('FIFA World Cup');
    expect(html).toContain('data-match-id="match-1"');
    expect(html).toContain('Data status: Ready');
    expect(html).toContain('Snapshot generated: Jul 1, 2026');
    expect(html).not.toContain('2026-07-01T00:00:00.000Z');
    expect(html).not.toContain('provider fixture context');
    expect(html).not.toContain('No provider matches');

    const todayPanelStart = html.indexOf('id="screen-today"');
    const todayPanelEnd = html.indexOf('</section>', todayPanelStart);
    const todayPanelHtml = html.slice(todayPanelStart, todayPanelEnd);

    const matchesPanelStart = html.indexOf('id="screen-matches"');
    const matchesPanelEnd = html.indexOf('</section>', matchesPanelStart);
    const matchesPanelHtml = html.slice(matchesPanelStart, matchesPanelEnd);

    expect(todayPanelHtml).not.toContain('Team Alpha vs Team Beta');
    expect(todayPanelHtml).not.toContain('Team Gamma vs Team Delta');
    expect(matchesPanelHtml).not.toContain('Team Alpha vs Team Beta');
    expect(matchesPanelHtml).not.toContain('Team Gamma vs Team Delta');

    const staleHtml = renderAppShell({
      activeTabId: 'matches',
      matchFeed: {
        status: 'empty',
        date: '2026-06-29',
        warnings: [],
        snapshot: {
          snapshotId: 'stale-snapshot',
          generatedAt: '2026-06-28T00:00:00.000Z',
          importedAt: '2026-06-28T00:01:00.000Z',
          matchCount: 0,
          competitions: [],
          sources: [],
          freshness: 'stale',
          warnings: []
        }
      }
    });
    expect(staleHtml).toContain('Data status: Stale');
    expect(staleHtml).toContain('Snapshot generated: Jun 28, 2026');
    expect(staleHtml).not.toContain('2026-06-28T00:00:00.000Z');
  });
});

describe('production shell entry match feed wiring', () => {
  it('loads match feed through the web service instead of hardcoded shell-only data', () => {
    const source = readFileSync(fileURLToPath(new URL('./shell-entry.ts', import.meta.url)), 'utf8');

    expect(source).toContain("import { getMatchFeed");
    expect(source).toContain("matchFeedState");
    expect(source).toContain("void refreshMatchFeed");
    expect(source).not.toContain("Team Alpha vs Team Beta");
  });
});

describe('production shell match filters panel', () => {
  const testMatchFeed = {
    status: 'ready' as const,
    date: '2026-06-30',
    warnings: [] as string[],
    snapshot: {
      snapshotId: 'test-snapshot',
      generatedAt: '2026-07-01T00:00:00.000Z',
      importedAt: '2026-07-01T00:00:00.000Z',
      matchCount: 3,
      competitions: [],
      sources: [],
      freshness: 'fresh' as const,
      warnings: []
    },
    matches: [
      {
        id: 'm1',
        competition: {
          id: 'c1',
          name: 'FIFA World Cup',
          type: 'national-team' as const,
          season: '2026'
        },
        kickoffUtc: '2026-06-30T14:00:00.000Z',
        status: 'scheduled' as const,
        homeTeam: { id: 't1', name: 'Japan' },
        awayTeam: { id: 't2', name: 'Vietnam' },
        score: { home: null, away: null },
        venue: 'Stadium A',
        sourceRefs: [],
        updatedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'm2',
        competition: {
          id: 'c2',
          name: 'FIFA World Cup Club',
          type: 'club' as const,
          season: '2026'
        },
        kickoffUtc: '2026-06-30T16:00:00.000Z',
        status: 'scheduled' as const,
        homeTeam: { id: 't3', name: 'Arsenal' },
        awayTeam: { id: 't4', name: 'Chelsea' },
        score: { home: 1, away: 0 },
        venue: 'Stadium B',
        sourceRefs: [],
        updatedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'm3',
        competition: {
          id: 'c3',
          name: 'Women Friendly',
          type: 'national-team' as const,
          season: '2026'
        },
        kickoffUtc: '2026-06-30T10:00:00.000Z',
        status: 'scheduled' as const,
        homeTeam: { id: 't5', name: 'USA Women' },
        awayTeam: { id: 't6', name: 'Germany' },
        score: { home: null, away: null },
        venue: 'Stadium C',
        sourceRefs: [],
        updatedAt: '2026-07-01T00:00:00.000Z'
      }
    ]
  };

  it('renders the filter panel with radio inputs and checkbox lists', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      isFilterPanelOpen: true,
      filters: {
        groupby: 'league',
        type: 'all',
        gender: 'all',
        selectedLeagues: new Set<string>()
      }
    });

    expect(html).toContain('id="matches-filter-panel"');
    expect(html).not.toContain('id="matches-filter-panel" hidden');
    expect(html).toContain('name="filter-groupby" value="league" checked');
    expect(html).toContain('name="filter-type" value="all" checked');
    expect(html).toContain('name="filter-gender" value="all" checked');
    
    // Check dynamic league checklist population
    expect(html).toContain('value="FIFA World Cup"');
    expect(html).toContain('value="FIFA World Cup Club"');
    expect(html).toContain('value="Women Friendly"');
  });

  const getMatchesPanelHtml = (html: string) => {
    const start = html.indexOf('id="screen-matches"');
    const end = html.indexOf('</section>', start);
    return html.slice(start, end);
  };

  it('filters matches by search query', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      searchQuery: 'Japan'
    });
    const panel = getMatchesPanelHtml(html);

    expect(panel).toContain('Japan vs Vietnam');
    expect(panel).not.toContain('Arsenal vs Chelsea');
    expect(panel).not.toContain('USA Women vs Germany');
  });

  it('filters matches by competition type (national vs club)', () => {
    const htmlNational = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'national',
        gender: 'all',
        selectedLeagues: new Set<string>()
      }
    });
    const panelNational = getMatchesPanelHtml(htmlNational);
    expect(panelNational).toContain('Japan vs Vietnam'); // FIFA World Cup is national
    expect(panelNational).toContain('USA Women vs Germany'); // Women Friendly is national
    expect(panelNational).not.toContain('Arsenal vs Chelsea'); // canonical type is club

    const htmlClub = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'club',
        gender: 'all',
        selectedLeagues: new Set<string>()
      }
    });
    const panelClub = getMatchesPanelHtml(htmlClub);
    expect(panelClub).not.toContain('Japan vs Vietnam');
    expect(panelClub).not.toContain('USA Women vs Germany');
    expect(panelClub).toContain('Arsenal vs Chelsea');
  });

  it('filters matches by gender (men vs women)', () => {
    const htmlWomen = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'all',
        gender: 'women',
        selectedLeagues: new Set<string>()
      }
    });
    const panelWomen = getMatchesPanelHtml(htmlWomen);
    expect(panelWomen).toContain('USA Women vs Germany');
    expect(panelWomen).not.toContain('Japan vs Vietnam');
    expect(panelWomen).not.toContain('Arsenal vs Chelsea');

    const htmlMen = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'all',
        gender: 'men',
        selectedLeagues: new Set<string>()
      }
    });
    const panelMen = getMatchesPanelHtml(htmlMen);
    expect(panelMen).not.toContain('USA Women vs Germany');
    expect(panelMen).toContain('Japan vs Vietnam');
    expect(panelMen).toContain('Arsenal vs Chelsea');
  });

  it('filters matches by selected leagues', () => {
    const htmlLeagues = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'all',
        gender: 'all',
        selectedLeagues: new Set<string>(['FIFA World Cup Club', 'FIFA World Cup'])
      }
    });
    const panelLeagues = getMatchesPanelHtml(htmlLeagues);
    expect(panelLeagues).toContain('Japan vs Vietnam');
    expect(panelLeagues).toContain('Arsenal vs Chelsea');
    expect(panelLeagues).not.toContain('USA Women vs Germany');
  });

  it('groups matches by league and sorts by kickoff time when groupby is time', () => {
    const htmlTime = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'time',
        type: 'all',
        gender: 'all',
        selectedLeagues: new Set<string>()
      }
    });
    
    // When grouped by time, there is only one date group header, e.g. "2026-06-30"
    expect(htmlTime).toContain('<div class="group-label">2026-06-30</div>');
    // Ensure all matches are rendered
    expect(htmlTime).toContain('USA Women vs Germany');
    expect(htmlTime).toContain('Japan vs Vietnam');
    expect(htmlTime).toContain('Arsenal vs Chelsea');

    const htmlLeague = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'all',
        gender: 'all',
        selectedLeagues: new Set<string>()
      }
    });
    // When grouped by league, there are league group headers:
    expect(htmlLeague).toContain('<div class="group-label">FIFA World Cup</div>');
    expect(htmlLeague).toContain('<div class="group-label">FIFA World Cup Club</div>');
    expect(htmlLeague).toContain('<div class="group-label">Women Friendly</div>');
  });

  it('renders matches empty state when no matches match filters', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      searchQuery: 'NonExistentTeamName'
    });

    expect(html).toContain('style="display: block;"');
    expect(html).toContain('No serving match store matches match the current filters.');
    expect(html).not.toContain('No provider matches');
  });
});

describe('production shell smooth tab navigation and skeleton loading', () => {
  it('generates accessible skeleton placeholder markup for metrics, cards, and list rows', () => {
    const metricSkeleton = renderSkeletonMetrics(3);
    expect(metricSkeleton).toContain('class="metric-grid" aria-hidden="true"');
    expect(metricSkeleton).toContain('class="skeleton-text heading"');

    const betSkeleton = renderSkeletonBetRows(2);
    expect(betSkeleton).toContain('class="bet-row bet-card"');
    expect(betSkeleton).toContain('class="skeleton-pill"');

    const matchSkeleton = renderSkeletonMatchRows(3);
    expect(matchSkeleton).toContain('class="match-row"');
    expect(matchSkeleton).toContain('class="date-group" aria-hidden="true"');

    const ledgerSkeleton = renderSkeletonLedgerRows(2);
    expect(ledgerSkeleton).toContain('class="ledger-row"');

    const cardSkeleton = renderSkeletonCard();
    expect(cardSkeleton).toContain('class="note-card" aria-hidden="true"');
  });

  it('renders skeleton placeholders on Today, Matches, Bets, and Bankroll screens during API loading', () => {
    // Today loading state
    const todayHtml = renderAppShell({
      activeTabId: 'today',
      bankrollState: { status: 'loading' },
      reportState: { status: 'loading' },
      betRecordsState: { status: 'loading' },
      disciplineConfigState: { status: 'loading' }
    });
    expect(todayHtml).toContain('class="skeleton-text heading"');
    expect(todayHtml).toContain('class="skeleton-pill"');

    // Matches loading state
    const matchesHtml = renderAppShell({
      activeTabId: 'matches',
      matchFeed: { status: 'loading', date: '2026-08-25' }
    });
    expect(matchesHtml).toContain('data-match-feed-state="loading"');
    expect(matchesHtml).toContain('class="match-row"');

    // Bets loading state
    const betsHtml = renderAppShell({
      activeTabId: 'bets',
      betRecordsState: { status: 'loading' }
    });
    expect(betsHtml).toContain('data-bet-records-state="loading"');
    expect(betsHtml).toContain('class="bet-row bet-card"');

    // Bankroll loading state
    const bankrollHtml = renderAppShell({
      activeTabId: 'bankroll',
      bankrollState: { status: 'loading' }
    });
    expect(bankrollHtml).toContain('data-bankroll-state="loading"');
  });

  it('wires non-destructive active screen switching and flicker-free sub-tab updates in shell entry', () => {
    const shellSource = readFileSync(fileURLToPath(new URL('./shell-entry.ts', import.meta.url)), 'utf8');
    expect(shellSource).toContain('setActiveScreen(tabId);');
    expect(shellSource).toContain('updateUrl(tabId);');
    expect(shellSource).toContain('function setActiveScreen(screenName: string): void');
    expect(shellSource).toContain('existing.innerHTML = newEl.innerHTML;');
    expect(shellSource).toContain('updateBetsScreenView();');
    expect(shellSource).toContain('updateBankrollScreenView();');
    expect(shellSource).toContain('updateMatchesScreenView();');
    expect(shellSource).toContain('updateTodayScreenView();');
  });
});

