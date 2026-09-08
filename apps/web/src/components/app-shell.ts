import { getSafeNavigationTabId, navigationTabs, type NavigationTab } from '../config/navigation-tabs.js';
import { t, type SupportedLocale, type TranslateFunction } from '../services/i18n-service.js';
import type { MatchFeedViewState } from '../services/match-feed-service.js';
import type { LiveMatchViewState } from '../services/live-match-service.js';
import type { BetRecordsViewState } from '../services/bet-record-service.js';
import type { BankrollViewState } from '../services/bankroll-service.js';
import type { BetReportPeriod, BetReportViewState, DisciplineConfigViewState } from '../services/core-betting-service.js';
import { renderBottomNavigation } from './bottom-navigation.js';
import { escapeHtml } from './html.js';
import { renderBetsScreen, type BetRecordFilter } from './screens/bets-screen.js';
import { renderBankrollScreen, type BankrollSecondaryView } from './screens/bankroll-screen.js';
import { renderMatchesScreen, renderMatchDetailScreen, type MatchFilters } from './screens/matches-screen.js';
import { renderTodayScreen } from './screens/today-screen.js';

export { getRibbonDates } from './screens/matches-screen.js';

const closeIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const defaultMatchFeed: MatchFeedViewState = Object.freeze({ status: 'loading', date: new Date().toISOString().slice(0, 10) });
const defaultLiveMatches: LiveMatchViewState = Object.freeze({ status: 'loading' });
const defaultBetRecordsState: BetRecordsViewState = Object.freeze({ status: 'loading' });
const defaultBankrollState: BankrollViewState = Object.freeze({ status: 'loading' });
const defaultDisciplineConfigState: DisciplineConfigViewState = Object.freeze({ status: 'loading' });
const defaultReportState: BetReportViewState = Object.freeze({ status: 'loading' });

export function getTodayDateTileParts(date = new Date()): { readonly day: string; readonly month: string } {
  return { day: String(date.getDate()), month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date).toUpperCase() };
}

function renderSheets(bankroll: BankrollViewState, translate: TranslateFunction): string {
  const bankrollGuard = bankroll.status === 'empty'
    ? `<section class="note-card warning" data-bankroll-setup-required><div class="note-title">${escapeHtml(translate('bankroll.setupRequired'))}</div><button class="primary-button" type="button" data-open-bankroll-setup>${escapeHtml(translate('bankroll.setupAction'))}</button></section>`
    : bankroll.status === 'compatibility'
      ? `<section class="note-card warning" data-bankroll-compatibility-required><div class="note-title">${escapeHtml(translate('bankroll.compatibilityRequired'))}</div></section>`
      : '';
  const options = (values: readonly string[], prefix: string) => values.map((value) => `<option value="${value}">${escapeHtml(translate(`${prefix}.${value}`))}</option>`).join('');
  const header = (id: string, title: string, subtitle = '') => `<div class="sheet-grabber" aria-hidden="true"></div><div class="sheet-header"><div><h2 class="sheet-title" id="${id}-title">${escapeHtml(title)}</h2>${subtitle ? `<p class="sheet-subtitle" id="${id}-subtitle">${escapeHtml(subtitle)}</p>` : ''}</div><button class="icon-button" type="button" data-close-sheet aria-label="${escapeHtml(translate('common.close'))}">${closeIcon}</button></div>`;
  return `<div class="sheet-backdrop" data-close-sheet></div>
    <section class="sheet" id="add-sheet" aria-hidden="true" aria-modal="true" aria-labelledby="add-sheet-title" role="dialog" data-focus-trap>${header('add-sheet', translate('bets.add'), translate('bets.manualMatch'))}<div class="sheet-body">${bankrollGuard}<form class="form-grid" id="add-form" novalidate>
      <div class="readonly-summary" id="match-summary-readonly"><div class="context-line"><div class="context-label">${escapeHtml(translate('bets.manualMatch'))}</div><div class="context-value" id="add-summary-title">—</div></div></div>
      <div class="field-grid two"><div class="field"><label for="home-team">${escapeHtml(translate('bets.homeTeam'))}</label><input class="field-input" id="home-team" name="home-team" required></div><div class="field"><label for="away-team">${escapeHtml(translate('bets.awayTeam'))}</label><input class="field-input" id="away-team" name="away-team" required></div></div>
      <div class="field"><label for="market-field">${escapeHtml(translate('bets.market'))}</label><select class="field-select" id="market-field" name="market-field" required><option value="">—</option>${options(['1X2','over_under','handicap','corners','custom'], 'market')}</select></div>
      <div class="field"><label for="selection-field">${escapeHtml(translate('bets.selection'))}</label><input class="field-input" id="selection-field" name="selection-field" required></div>
      <div class="field-grid two"><div class="field"><label for="odds-field">${escapeHtml(translate('bets.odds'))}</label><input class="field-input" id="odds-field" name="odds-field" type="number" step="0.0001" required></div><div class="field"><label for="stake-field">${escapeHtml(translate('bets.stake'))}</label><input class="field-input" id="stake-field" name="stake-field" type="number" min="0.01" step="0.01" required></div></div>
      <div class="field-grid two"><div class="field"><label for="emotion-field">${escapeHtml(translate('bets.emotion'))}</label><select class="field-select" id="emotion-field" name="emotion-field"><option value="">—</option>${options(['calm','excited','frustrated','anxious','tired'], 'emotion')}</select></div><div class="field"><label for="motivation-field">${escapeHtml(translate('bets.motivation'))}</label><select class="field-select" id="motivation-field" name="motivation-field"><option value="">—</option>${options(['planned_analysis','familiar_market','chasing_loss','fomo','impulse','other'], 'motivation')}</select></div></div>
      <div class="field"><label for="pre-bet-plan-adherence">${escapeHtml(translate('bets.planAdherence'))}</label><select class="field-select" id="pre-bet-plan-adherence" name="pre-bet-plan-adherence" required><option value="">—</option>${options(['yes','partly','no'], 'adherence')}</select></div>
      <div class="field"><label for="note-field">${escapeHtml(translate('bets.note'))}</label><textarea class="field-textarea" id="note-field" name="note-field"></textarea></div>
      <div class="sheet-actions"><button class="secondary-button" id="save-draft-shell" type="submit" name="bet-action" value="draft">${escapeHtml(translate('bets.saveDraft'))}</button><button class="primary-button" id="record-ongoing-bet" type="submit" name="bet-action" value="ongoing">${escapeHtml(translate('bets.recordOngoing'))}</button></div><div class="sheet-feedback" id="add-feedback" aria-live="polite"></div>
    </form></div></section>
    <section class="sheet" id="discipline-challenge-sheet" aria-hidden="true" aria-modal="true" aria-labelledby="discipline-challenge-sheet-title" role="dialog" data-focus-trap>${header('discipline-challenge-sheet', translate('bets.disciplineBreach'))}<div class="sheet-body"><section class="note-card warning"><p class="note-copy">${escapeHtml(translate('bets.disciplineExplanation'))}</p><div class="note-title" id="discipline-countdown">${escapeHtml(translate('bets.availableIn', { seconds: 15 }))}</div></section><label class="filter-option"><input id="discipline-acknowledge" type="checkbox">${escapeHtml(translate('bets.acknowledge'))}</label><div class="sheet-actions"><button class="secondary-button" type="button" data-close-sheet>${escapeHtml(translate('common.cancel'))}</button><button class="primary-button" id="discipline-finalize" type="button" disabled>${escapeHtml(translate('common.confirm'))}</button></div><div class="sheet-feedback" id="discipline-feedback" aria-live="polite"></div></div></section>
    <section class="sheet" id="settlement-sheet" aria-hidden="true" aria-modal="true" aria-labelledby="settlement-sheet-title" role="dialog" data-focus-trap>${header('settlement-sheet', translate('bets.settle'))}<div class="sheet-body"><div class="stack" id="settlement-timeline" aria-live="polite"></div><form class="form-grid" id="settlement-form"><div class="field"><label for="settlement-type">${escapeHtml(translate('bets.chooseOutcome'))}</label><select class="field-select" id="settlement-type" name="settlementType" required>${options(['full_win','half_win','push','void','half_loss','full_loss','manual_adjustment'], 'settlement')}</select></div><div class="field" id="manual-adjustment-fields" hidden><label for="manual-profit-loss">${escapeHtml(translate('bets.pnl'))}</label><input class="field-input" id="manual-profit-loss" name="profitLossPoints" type="number" step="0.0001"><label for="adjustment-reason">${escapeHtml(translate('bets.manualReason'))}</label><textarea class="field-textarea" id="adjustment-reason" name="adjustmentReason"></textarea></div><div class="field" id="legacy-plan-adherence-field" hidden><label for="plan-adherence">${escapeHtml(translate('bets.planAdherence'))}</label><select class="field-select" id="plan-adherence" name="planAdherence"><option value="">—</option>${options(['yes','partly','no'], 'adherence')}</select></div><div class="field"><label for="lesson-note">${escapeHtml(translate('bets.lessonNote'))}</label><textarea class="field-textarea" id="lesson-note" name="lessonNote"></textarea></div><section class="note-card"><div class="note-eyebrow">${escapeHtml(translate('bets.previewPnl'))}</div><div class="note-title" id="settlement-preview">—</div></section><div class="sheet-actions"><button class="secondary-button" type="button" data-close-sheet>${escapeHtml(translate('common.cancel'))}</button><button class="primary-button" type="submit">${escapeHtml(translate('bets.confirmSettlement'))}</button></div><div class="sheet-feedback" id="settlement-feedback" aria-live="polite"></div></form></div></section>
    <section class="sheet" id="ledger-adjustment-sheet" aria-hidden="true" aria-modal="true" aria-labelledby="ledger-adjustment-sheet-title" role="dialog" data-focus-trap>${header('ledger-adjustment-sheet', translate('bankroll.ledgerEntry'))}<div class="sheet-body"><form class="form-grid" id="ledger-adjustment-form"><div class="field"><label for="ledger-entry-type">${escapeHtml(translate('bankroll.entryType'))}</label><select class="field-select" id="ledger-entry-type" name="entryType" required><option value="deposit">${escapeHtml(translate('bankroll.deposit'))}</option><option value="withdrawal">${escapeHtml(translate('bankroll.withdrawal'))}</option><option value="correction">${escapeHtml(translate('bankroll.correction'))}</option></select></div><div class="field"><label for="ledger-amount">${escapeHtml(translate('bankroll.points'))}</label><input class="field-input" id="ledger-amount" name="amountPoints" type="number" step="0.01" required><p class="field-hint">${escapeHtml(translate('bankroll.amountGuidance'))}</p></div><div class="field"><label for="ledger-note">${escapeHtml(translate('bets.note'))}</label><textarea class="field-textarea" id="ledger-note" name="note"></textarea></div><div class="sheet-actions"><button class="secondary-button" type="button" data-close-sheet>${escapeHtml(translate('common.cancel'))}</button><button class="primary-button" type="submit">${escapeHtml(translate('common.confirm'))}</button></div><div class="sheet-feedback" id="ledger-feedback" aria-live="polite"></div></form></div></section>
    <section class="sheet" id="settings-sheet" aria-hidden="true" aria-modal="true" aria-labelledby="settings-sheet-title" role="dialog" data-focus-trap>${header('settings-sheet', translate('settings.title'))}<div class="sheet-body"><form class="form-grid" id="settings-form"><div class="field"><label for="settings-locale">${escapeHtml(translate('settings.language'))}</label><select class="field-select" id="settings-locale" name="locale"><option value="en">${escapeHtml(translate('settings.english'))}</option><option value="vi">${escapeHtml(translate('settings.vietnamese'))}</option></select></div><div class="field"><label for="settings-density">${escapeHtml(translate('settings.displayDensity'))}</label><select class="field-select" id="settings-density" name="displayDensity"><option value="standard">${escapeHtml(translate('settings.standard'))}</option><option value="compact">${escapeHtml(translate('settings.compact'))}</option></select></div><div class="field"><label for="settings-timezone">${escapeHtml(translate('settings.timezone'))}</label><select class="field-select" id="settings-timezone" name="timezone"><option value="local">${escapeHtml(translate('settings.timezoneLocal'))}</option><option value="UTC">UTC</option><option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option></select></div><button class="primary-button" type="submit">${escapeHtml(translate('common.save'))}</button><button class="secondary-button" type="button" data-owner-logout>${escapeHtml(translate('auth.signOut'))}</button></form></div></section>`;
}

export function renderAppShell({
  activeTabId = 'today', translate = t, locale = 'en', matchFeed = defaultMatchFeed, timezone = 'local',
  liveMatches = defaultLiveMatches, liveMode = false,
  filters = { groupby: 'league', type: 'all', gender: 'all', selectedLeagues: new Set<string>() },
  searchQuery = '', isFilterPanelOpen = false, betRecordsState = defaultBetRecordsState,
  bankrollState = defaultBankrollState, betRecordFilter = 'ongoing', bankrollView = 'overview',
  disciplineConfigState = defaultDisciplineConfigState, reportState = defaultReportState,
  todayReportState = defaultReportState, reportPeriod = 'week',
  customCalendarMonth, customRangeStart = null, customRangeEnd = null,
  isMatchesCalendarOpen = false, matchesCalendarMonth
}: {
  readonly activeTabId?: string;
  readonly translate?: TranslateFunction;
  readonly locale?: SupportedLocale;
  readonly matchFeed?: MatchFeedViewState;
  readonly liveMatches?: LiveMatchViewState;
  readonly liveMode?: boolean;
  readonly timezone?: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh';
  readonly filters?: MatchFilters;
  readonly searchQuery?: string;
  readonly isFilterPanelOpen?: boolean;
  readonly betRecordsState?: BetRecordsViewState;
  readonly bankrollState?: BankrollViewState;
  readonly betRecordFilter?: BetRecordFilter;
  readonly bankrollView?: BankrollSecondaryView;
  readonly disciplineConfigState?: DisciplineConfigViewState;
  readonly reportState?: BetReportViewState;
  readonly todayReportState?: BetReportViewState;
  readonly reportPeriod?: BetReportPeriod;
  readonly customCalendarMonth?: string | undefined;
  readonly customRangeStart?: string | null | undefined;
  readonly customRangeEnd?: string | null | undefined;
  readonly isMatchesCalendarOpen?: boolean | undefined;
  readonly matchesCalendarMonth?: string | undefined;
} = {}): string {
  const safeActiveTabId = getSafeNavigationTabId(activeTabId);
  const activeTab = navigationTabs.find((tab: NavigationTab) => tab.id === safeActiveTabId) ?? navigationTabs[0];
  const resolvedTimeZone = timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone;
  const panels = [
    renderTodayScreen({ activeTabId: safeActiveTabId, translate, bets: betRecordsState, bankroll: bankrollState, discipline: disciplineConfigState, report: todayReportState, matchFeed, locale, timezone }),
    renderMatchesScreen({ activeTabId: safeActiveTabId, translate, locale, matchFeed, liveMatches, liveMode, timezone, filters, searchQuery, isFilterPanelOpen, isCalendarOpen: isMatchesCalendarOpen, ...(matchesCalendarMonth !== undefined ? { calendarMonth: matchesCalendarMonth } : {}) }),
    renderBetsScreen({ activeTabId: safeActiveTabId, translate, state: betRecordsState, filter: betRecordFilter, bankroll: bankrollState }),
    renderBankrollScreen({ activeTabId: safeActiveTabId, translate, locale, timeZone: resolvedTimeZone, state: bankrollState, view: bankrollView, disciplineConfigState, reportState, reportPeriod, customCalendarMonth, customRangeStart, customRangeEnd })
  ].join('');
  return `<div class="production-page"><div class="app-shell" data-production-shell="phase-5-9" data-production-baseline="black-apple-ledger" aria-label="${escapeHtml(translate('common.appLabel'))}"><div class="pull-refresh-indicator" id="pull-refresh-indicator" data-pull-progress="0" aria-live="polite">${escapeHtml(translate('live.pullToRefresh'))}</div><main class="main-scroll" id="main-scroll" data-active-tab="${escapeHtml(safeActiveTabId)}" aria-label="${escapeHtml(translate(activeTab.descriptionKey, activeTab.fallbackDescription))}">${panels}${renderMatchDetailScreen(translate)}</main>${renderBottomNavigation({ activeTabId: safeActiveTabId, tabs: navigationTabs, translate })}${renderSheets(bankrollState, translate)}</div></div>`;
}
