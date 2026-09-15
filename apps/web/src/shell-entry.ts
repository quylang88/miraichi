import { getSafeNavigationTabId, type ProductionNavigationTabId } from './config/navigation-tabs.js';
import { renderAppShell } from './components/app-shell.js';
import { renderMatchDetailView } from './components/match-detail-view.js';
import { createSettingsService } from './services/settings-service.js';
import { createTranslator } from './services/i18n-service.js';
import { getMatchFeed, type MatchFeedViewState } from './services/match-feed-service.js';
import { deleteCloudBetDraft, loadBetRecordsViewState, saveCloudBetDraft, updateCloudBetDraft, type BetRecordsViewState } from './services/bet-record-service.js';
import { createLedgerEntry, loadBankrollViewState, setupBankroll, type BankrollViewState } from './services/bankroll-service.js';
import { createMatchDetailController, type MatchDetailControllerState } from './services/match-detail-controller.js';
import {
  ApiRequestError,
  createDisciplineChallenge,
  createOngoingBet,
  loadBetReport,
  loadBetSettlementTimeline,
  loadDisciplineConfig,
  settleCloudBet,
  updateDisciplineConfig,
  type BetReportPeriod,
  type BetReportViewState,
  type DisciplineConfigViewState
} from './services/core-betting-service.js';
import { calculateHkSettlementProfitLoss, getLocalDateFromUtc, type AddBetDraft, type BetSettlementEvent, type CreateOngoingBetInput, type DisciplineChallenge, type SettlementType } from '@miraichi/shared';
import { renderSettlementTimeline, type BetRecordFilter } from './components/screens/bets-screen.js';
import type { BankrollSecondaryView } from './components/screens/bankroll-screen.js';
import { renderTodayScreen } from './components/screens/today-screen.js';
import { renderMatchesScreen } from './components/screens/matches-screen.js';
import { formatMatchTitleHtml } from './components/screens/screen-shared.js';
import { renderBetsScreen } from './components/screens/bets-screen.js';
import { renderBankrollScreen } from './components/screens/bankroll-screen.js';
import { refreshLiveMatches, type LiveMatchViewState } from './services/live-match-service.js';
import { createLiveMode, retainLastGoodLive } from './live/live-mode.js';
import { createLiveRefreshLifecycle } from './live/live-refresh-lifecycle.js';
import { bindPullDownRefresh } from './live/pull-down-refresh.js';
import {
  startAddBetSession,
  type AddBetFormElements,
  type AddBetSessionState
} from './features/add-bet/add-bet-session.js';
import {
  clearRunningContext,
  createBetEntryState,
  enableManualBetLine,
  getLinePresets,
  getSelectionCodes,
  restoreBetEntryState,
  selectBetLinePreset,
  selectBetMarket,
  selectBetPeriod,
  selectBetSelection,
  selectRunningWindow,
  setManualRunningContext,
  setManualBetLine,
  setRunningContext,
  toStructuredBetSelection,
  type BetEntryState
} from './features/add-bet/bet-entry-model.js';
import { getAvailableRunningWindows, resolveRunningContext } from './features/add-bet/running-context-resolver.js';
import type { CreatableMarketType, MarketPeriod, RunningWindow, SelectionCode } from '@miraichi/shared';


const root = document.getElementById('app-root');

if (!root) {
  throw new Error('Missing app-root element for Miraichi production shell.');
}

const appRoot = root;
const settingsService = createSettingsService();

let currentScreenName = 'today';
let matchDetailReturnScreen: ProductionNavigationTabId = 'today';
let currentSearchQuery = '';

const activeFilters = {
  groupby: 'league',
  type: 'all',
  gender: 'all',
  selectedLeagues: new Set<string>()
};
let isFilterPanelOpen = false;
let currentOpenMatchId = '';
let currentOpenMatchTitle = '';
let currentOpenHomeTeam = '';
let currentOpenAwayTeam = '';
let betRecordsState: BetRecordsViewState = { status: 'loading' };
let bankrollState: BankrollViewState = { status: 'loading' };
let betRecordFilter: BetRecordFilter = 'ongoing';
let bankrollView: BankrollSecondaryView = 'overview';
let disciplineConfigState: DisciplineConfigViewState = { status: 'loading' };
let bankrollReportState: BetReportViewState = { status: 'loading' };
let todayReportState: BetReportViewState = { status: 'loading' };
let reportPeriod: BetReportPeriod = 'week';
let customCalendarMonth = todayLocalDate().slice(0, 7);
let customRangeStart: string | null = null;
let customRangeEnd: string | null = null;
let isMatchesCalendarOpen = false;
let matchesCalendarMonth = todayLocalDate().slice(0, 7);
let selectedSettlementBetId = '';
let selectedSettlementTimeline: readonly BetSettlementEvent[] = [];
let pendingOngoingInput: CreateOngoingBetInput | null = null;
let pendingDisciplineChallenge: DisciplineChallenge | null = null;
let editingDraftId: string | null = null;
let pendingOngoingDraftId: string | null = null;
let disciplineCountdownTimer: number | null = null;
let lastFocusedElement: HTMLElement | null = null;
let betEntryState: BetEntryState = createBetEntryState();
let resolvedRunningMatchId = '';

function getTargetTimezone(): string {
  const settings = settingsService.getSettings();
  return settings.timezone === 'local'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : settings.timezone;
}

function todayLocalDate(): string {
  const tz = getTargetTimezone();
  return getLocalDateFromUtc(new Date().toISOString(), tz);
}

let matchFeedState: MatchFeedViewState = {
  status: 'loading',
  date: todayLocalDate()
};
let liveMatchState: LiveMatchViewState = { status: 'loading' };
const matchesLiveMode = createLiveMode(() => refreshLiveMatchView('manual'));
let liveMatchRequestVersion = 0;
let unbindPullDownRefresh: (() => void) | null = null;

let matchDetailState: MatchDetailControllerState = { status: 'loading' };
const matchDetailController = createMatchDetailController({onState(state) {matchDetailState=state;renderMatchDetailState();}});

function getInitialTabId(): ProductionNavigationTabId {
  const params = new URLSearchParams(window.location.search);
  return getSafeNavigationTabId(params.get('tab') || 'today');
}

function isPrimaryTabId(value: string): value is ProductionNavigationTabId {
  return getSafeNavigationTabId(value) === value;
}

function updateScreenContent(id: string, html: string): void {
  const existing = document.getElementById(id);
  if (!existing) return;
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const newEl = temp.firstElementChild;
  if (newEl) {
    existing.innerHTML = newEl.innerHTML;
  }
}

function updateTodayScreenView(): void {
  const settings = settingsService.getSettings();
  const translate = createTranslator(settings.locale);
  updateScreenContent('screen-today', renderTodayScreen({
    activeTabId: isPrimaryTabId(currentScreenName) ? currentScreenName : 'today',
    translate,
    bets: betRecordsState,
    bankroll: bankrollState,
    discipline: disciplineConfigState,
    report: todayReportState,
    matchFeed: matchFeedState,
    locale: settings.locale,
    timezone: settings.timezone
  }));
}

function updateMatchesScreenView(): void {
  const settings = settingsService.getSettings();
  const translate = createTranslator(settings.locale);
  updateScreenContent('screen-matches', renderMatchesScreen({
    activeTabId: isPrimaryTabId(currentScreenName) ? currentScreenName : 'today',
    translate,
    locale: settings.locale,
    matchFeed: matchFeedState,
    liveMatches: liveMatchState,
    liveMode: matchesLiveMode.active,
    timezone: settings.timezone,
    filters: activeFilters,
    searchQuery: currentSearchQuery,
    isFilterPanelOpen,
    isCalendarOpen: isMatchesCalendarOpen,
    calendarMonth: matchesCalendarMonth || matchFeedState.date.slice(0, 7)
  }));
  const searchInput = appRoot.querySelector('#match-search') as HTMLInputElement | null;
  if (searchInput && searchInput.value !== currentSearchQuery) {
    searchInput.value = currentSearchQuery;
  }
}

function updateBetsScreenView(): void {
  const settings = settingsService.getSettings();
  const translate = createTranslator(settings.locale);
  updateScreenContent('screen-bets', renderBetsScreen({
    activeTabId: isPrimaryTabId(currentScreenName) ? currentScreenName : 'today',
    translate,
    state: betRecordsState,
    filter: betRecordFilter,
    bankroll: bankrollState
  }));
}

function updateBankrollScreenView(): void {
  const settings = settingsService.getSettings();
  const translate = createTranslator(settings.locale);
  const resolvedTimeZone = settings.timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : settings.timezone;
  updateScreenContent('screen-bankroll', renderBankrollScreen({
    activeTabId: isPrimaryTabId(currentScreenName) ? currentScreenName : 'today',
    translate,
    locale: settings.locale,
    timeZone: resolvedTimeZone,
    state: bankrollState,
    view: bankrollView,
    disciplineConfigState,
    reportState: bankrollReportState,
    reportPeriod,
    customCalendarMonth,
    customRangeStart,
    customRangeEnd
  }));
}

function render(activeTabId: string, fullRebuild = false): void {
  const safeActiveTabId = getSafeNavigationTabId(activeTabId);
  currentScreenName = safeActiveTabId;
  matchDetailReturnScreen = safeActiveTabId;

  // Save focus state
  const activeElementId = document.activeElement?.id;
  let selectionStart: number | null = null;
  let selectionEnd: number | null = null;
  if (document.activeElement instanceof HTMLInputElement) {
    selectionStart = document.activeElement.selectionStart;
    selectionEnd = document.activeElement.selectionEnd;
  }

  const settings = settingsService.getSettings();
  const translate = createTranslator(settings.locale);
  document.documentElement.lang = settings.locale;

  const shellEl = appRoot.querySelector('.app-shell');
  if (!shellEl || fullRebuild) {
    appRoot.innerHTML = renderAppShell({
      activeTabId: safeActiveTabId,
      translate,
      locale: settings.locale,
      matchFeed: matchFeedState,
      liveMatches: liveMatchState,
      liveMode: matchesLiveMode.active,
      timezone: settings.timezone,
      filters: activeFilters,
      searchQuery: currentSearchQuery,
      isFilterPanelOpen,
      betRecordsState,
      bankrollState,
      betRecordFilter,
      bankrollView,
      disciplineConfigState,
      reportState: bankrollReportState,
      todayReportState,
      reportPeriod,
      customCalendarMonth,
      customRangeStart,
      customRangeEnd,
      isMatchesCalendarOpen,
      matchesCalendarMonth: matchesCalendarMonth || matchFeedState.date.slice(0, 7)
    });
    appRoot.querySelector('.app-shell')?.setAttribute('data-locale', settings.locale);
    appRoot.querySelector('.app-shell')?.setAttribute('data-density', settings.displayDensity);
    bindCurrentPullDownRefresh();
  } else {
    updateTodayScreenView();
    updateMatchesScreenView();
    updateBetsScreenView();
    updateBankrollScreenView();
  }

  // Restore filter values and apply
  const searchInput = appRoot.querySelector('#match-search') as HTMLInputElement | null;
  if (searchInput && searchInput.value !== currentSearchQuery) {
    searchInput.value = currentSearchQuery;
  }
  // Restore focus state
  if (activeElementId) {
    const elementToFocus = document.getElementById(activeElementId);
    if (elementToFocus && document.activeElement !== elementToFocus) {
      elementToFocus.focus();
      if (elementToFocus instanceof HTMLInputElement && selectionStart !== null && selectionEnd !== null) {
        elementToFocus.setSelectionRange(selectionStart, selectionEnd);
      }
    }
  }
}

function updateUrl(tabId: ProductionNavigationTabId): void {
  const url = new URL(window.location.href);
  if (tabId === 'today') {
    url.searchParams.delete('tab');
  } else {
    url.searchParams.set('tab', tabId);
  }
  window.history.replaceState({ tabId }, '', url);
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setHtml(id: string, html: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.innerHTML = html;
  }
}
function renderMatchDetailState(): void {
  const infoPanel = document.getElementById('match-detail-panel-info');
  if (!infoPanel) return;
  const settings = settingsService.getSettings();
  const timeZone = settings.timezone === 'local'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : settings.timezone;
  infoPanel.innerHTML = renderMatchDetailView(
    matchDetailState,
    createTranslator(settings.locale),
    settings.locale,
    timeZone
  );
}

function cancelMatchDetailLoad(): void {
  matchDetailController.cancel();
}

async function loadAndRenderMatchDetail(matchId: string): Promise<void> {
  await matchDetailController.open(matchId);
}


function setActiveScreen(screenName: string): void {
  currentScreenName = screenName;

  appRoot.querySelectorAll<HTMLElement>('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === `screen-${screenName}`);
  });

  appRoot.querySelectorAll<HTMLElement>('.nav-item').forEach((item) => {
    const isActive = item.dataset.screen === screenName;
    item.classList.toggle('active', isActive);
    if (isActive) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });

  const mainScroll = document.getElementById('main-scroll');
  if (mainScroll) {
    mainScroll.dataset.activeTab = screenName;
    mainScroll.scrollTop = 0;
  }
}

function setMatchDetailContext(title: string, meta: string, homeTeamName: string, awayTeamName: string): void {
  currentOpenMatchTitle = title;
  currentOpenHomeTeam = homeTeamName;
  currentOpenAwayTeam = awayTeamName;
  setHtml('match-detail-title', formatMatchTitleHtml(title));
  setText('match-detail-meta', meta);
}

function resetMatchDetailTabs(): void {
  appRoot.querySelectorAll<HTMLElement>('[data-detail-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.detailTab === 'bets');
  });

  const betsPanel = document.getElementById('match-detail-panel-bets');
  const infoPanel = document.getElementById('match-detail-panel-info');
  if (betsPanel) {
    betsPanel.hidden = false;
  }
  if (infoPanel) {
    infoPanel.hidden = true;
  }
}

function openSheet(sheetName: string | null | undefined): void {
  if (!sheetName) {
    return;
  }

  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let found = false;
  let openedSheet: HTMLElement | null = null;
  appRoot.querySelectorAll<HTMLElement>('.sheet').forEach((sheet) => {
    const open = sheet.id === `${sheetName}-sheet`;
    found = found || open;
    if (open) openedSheet = sheet;
    sheet.classList.toggle('open', open);
    sheet.setAttribute('aria-hidden', String(!open));
  });

  if (!found) {
    return;
  }

  appRoot.querySelector<HTMLElement>('.sheet-backdrop')?.classList.add('open');
  appRoot.querySelector<HTMLElement>('.app-shell')?.classList.add('sheet-open');
  window.setTimeout(() => {
    const firstFocusable = (openedSheet as HTMLElement | null)?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    firstFocusable?.focus();
  }, 0);
}

function closeSheets(): void {
  if (disciplineCountdownTimer !== null) {
    window.clearInterval(disciplineCountdownTimer);
    disciplineCountdownTimer = null;
  }
  appRoot.querySelectorAll<HTMLElement>('.sheet').forEach((sheet) => {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  });
  appRoot.querySelector<HTMLElement>('.sheet-backdrop')?.classList.remove('open');
  appRoot.querySelector<HTMLElement>('.app-shell')?.classList.remove('sheet-open');
  setText('add-feedback', '');
  editingDraftId = null;
  pendingOngoingDraftId = null;
  pendingOngoingInput = null;
  pendingDisciplineChallenge = null;
  lastFocusedElement?.focus();
  lastFocusedElement = null;
}

function updateAddFormState(): void {
  const addForm = document.getElementById('add-form');
  const saveDraftShell = document.getElementById('save-draft-shell') as HTMLButtonElement | null;
  const recordOngoing = document.getElementById('record-ongoing-bet') as HTMLButtonElement | null;
  const oddsField = document.getElementById('odds-field') as HTMLInputElement | null;
  const stakeField = document.getElementById('stake-field') as HTMLInputElement | null;

  if (!(addForm instanceof HTMLFormElement) || !saveDraftShell || !oddsField || !stakeField) {
    return;
  }

  const odds = oddsField.value.trim();
  const stake = stakeField.value.trim();
  saveDraftShell.disabled = !(toStructuredBetSelection(betEntryState) && odds && stake);
  if (recordOngoing) recordOngoing.disabled = !currentOpenMatchId;
}

function getAddBetFormElements(): AddBetFormElements | null {
  const form = document.getElementById('add-form') as HTMLFormElement | null;
  const homeTeam = document.getElementById('home-team') as HTMLInputElement | null;
  const awayTeam = document.getElementById('away-team') as HTMLInputElement | null;
  const feedback = document.getElementById('add-feedback');
  if (!form || !homeTeam || !awayTeam || !feedback) return null;
  return {
    form,
    controls: [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')],
    homeTeam,
    awayTeam,
    feedback
  };
}

function createBetChoice(label: string, attribute: string, value: string, active: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `bet-choice${active ? ' active' : ''}`;
  button.textContent = label;
  button.setAttribute(attribute, value);
  button.setAttribute('aria-pressed', String(active));
  return button;
}

function applyRunningSnapshotContext(): void {
  if (betEntryState.marketType !== 'running') return;
  if (liveMatchState.status !== 'ready') {
    betEntryState = clearRunningContext(betEntryState);
    resolvedRunningMatchId = '';
    return;
  }
  const resolution = resolveRunningContext({
    snapshot: liveMatchState.snapshot,
    stale: liveMatchState.stale,
    ...(currentOpenMatchId ? { matchId: currentOpenMatchId } : {}),
    homeTeamName: (document.getElementById('home-team') as HTMLInputElement | null)?.value ?? '',
    awayTeamName: (document.getElementById('away-team') as HTMLInputElement | null)?.value ?? ''
  });
  if (resolution.status === 'resolved') {
    betEntryState = setRunningContext(betEntryState, {
      liveScoreHome: resolution.liveScoreHome,
      liveScoreAway: resolution.liveScoreAway,
      liveMinute: resolution.liveMinute,
      liveContextSource: 'snapshot',
      liveContextObservedAt: resolution.observedAt
    });
    resolvedRunningMatchId = resolution.matchId;
    return;
  }
  betEntryState = clearRunningContext(betEntryState);
  resolvedRunningMatchId = '';
}

function readManualRunningContext(): void {
  const value = (id: string): number | null => {
    const raw = (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '';
    const parsed = Number(raw);
    return /^\d+$/.test(raw) && Number.isInteger(parsed) ? parsed : null;
  };
  const liveScoreHome = value('live-score-home-field');
  const liveScoreAway = value('live-score-away-field');
  const minute = value('live-minute-field');
  betEntryState = setManualRunningContext(betEntryState, {
    liveScoreHome: liveScoreHome !== null && liveScoreHome >= 0 ? liveScoreHome : null,
    liveScoreAway: liveScoreAway !== null && liveScoreAway >= 0 ? liveScoreAway : null,
    liveMinute: minute !== null && minute >= 0 && minute < 90 ? minute : null
  });
}

function renderBetEntryControls(): void {
  const translate = createTranslator(settingsService.getSettings().locale);
  const marketField = document.getElementById('market-field') as HTMLInputElement | null;
  const periodField = document.getElementById('market-period-field') as HTMLInputElement | null;
  const selectionField = document.getElementById('selection-code-field') as HTMLInputElement | null;
  const lineField = document.getElementById('line-value-field') as HTMLInputElement | null;
  if (marketField) marketField.value = betEntryState.marketType;
  if (periodField) periodField.value = betEntryState.marketPeriod;
  if (selectionField) selectionField.value = betEntryState.selectionCode;
  if (lineField) lineField.value = betEntryState.lineValue == null ? '' : String(betEntryState.lineValue);

  appRoot.querySelectorAll<HTMLButtonElement>('[data-bet-market]').forEach((button) => {
    const active = button.dataset.betMarket === betEntryState.marketType;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  appRoot.querySelectorAll<HTMLButtonElement>('[data-bet-period]').forEach((button) => {
    const active = button.dataset.betPeriod === betEntryState.marketPeriod;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const isRunning = betEntryState.marketType === 'running';
  const contextControl = document.getElementById('running-context-control');
  if (contextControl) contextControl.hidden = !isRunning;
  const contextReadonly = isRunning && betEntryState.liveContextSource === 'snapshot';
  const syncRunningInput = (id: string, value: number | null): void => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input) return;
    input.readOnly = contextReadonly;
    input.toggleAttribute('aria-readonly', contextReadonly);
    if (contextReadonly || value !== null || input.value === '') input.value = value === null ? '' : String(value);
  };
  syncRunningInput('live-score-home-field', betEntryState.liveScoreHome);
  syncRunningInput('live-score-away-field', betEntryState.liveScoreAway);
  syncRunningInput('live-minute-field', betEntryState.liveMinute);
  appRoot.querySelectorAll<HTMLButtonElement>('[data-running-context-source]').forEach((button) => {
    const active = button.dataset.runningContextSource === betEntryState.liveContextSource;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const contextFeedback = document.getElementById('running-context-feedback');
  if (contextFeedback) contextFeedback.textContent = contextReadonly
    ? translate('running.snapshotReady')
    : isRunning
      ? translate(betEntryState.liveScoreHome !== null && betEntryState.liveScoreAway !== null
        && betEntryState.liveMinute !== null ? 'running.manualActive' : 'running.manualRequired')
      : '';

  const runningWindowControl = document.getElementById('running-window-control');
  if (runningWindowControl) runningWindowControl.hidden = !isRunning;
  const availability = getAvailableRunningWindows(betEntryState.liveMinute ?? -1);
  appRoot.querySelectorAll<HTMLButtonElement>('[data-running-window]').forEach((button) => {
    const runningWindow = button.dataset.runningWindow as RunningWindow;
    const startMinute = Number(button.dataset.windowStart);
    const endMinute = Number(button.dataset.windowEnd);
    const available = runningWindow === 'to_half_time'
      ? availability.toHalfTime
      : runningWindow === 'to_full_time'
        ? availability.toFullTime
        : availability.fixed15.some((window) => window.startMinute === startMinute
          && window.endMinute === endMinute && window.available);
    const active = betEntryState.runningWindow === runningWindow
      && (runningWindow !== 'fixed_15'
        || (betEntryState.windowStartMinute === startMinute && betEntryState.windowEndMinute === endMinute));
    button.disabled = !available;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const periodControl = document.getElementById('bet-period-control');
  if (periodControl) periodControl.hidden = !betEntryState.marketType || isRunning;
  const selections = getSelectionCodes(betEntryState);
  const selectionControl = document.getElementById('bet-selection-control');
  if (selectionControl) selectionControl.hidden = selections.length === 0;
  const selectionChoices = document.getElementById('bet-selection-choices');
  selectionChoices?.replaceChildren(...selections.map((code) => createBetChoice(
    translate(`selection.${code}`), 'data-bet-selection', code, betEntryState.selectionCode === code
  )));

  const lineControl = document.getElementById('bet-line-control');
  if (lineControl) lineControl.hidden = !betEntryState.selectionCode || betEntryState.marketType === '1X2';
  const linePresets = document.getElementById('bet-line-presets');
  linePresets?.replaceChildren(...getLinePresets(betEntryState).map((line) => createBetChoice(
    `${line > 0 && betEntryState.marketType === 'handicap' ? '+' : ''}${line}`,
    'data-bet-line', String(line), !betEntryState.manualLineActive && betEntryState.lineValue === line
  )));
  const otherLine = appRoot.querySelector<HTMLButtonElement>('[data-manual-bet-line]');
  if (otherLine) {
    otherLine.classList.toggle('active', betEntryState.manualLineActive);
    otherLine.setAttribute('aria-pressed', String(betEntryState.manualLineActive));
  }
  const manualLineControl = document.getElementById('manual-bet-line-control');
  if (manualLineControl) manualLineControl.hidden = !betEntryState.manualLineActive;
  const manualLine = document.getElementById('manual-bet-line-field') as HTMLInputElement | null;
  if (manualLine && manualLine.value !== betEntryState.manualLineInput) manualLine.value = betEntryState.manualLineInput;
  if (manualLine) manualLine.setAttribute('aria-invalid', String(betEntryState.manualLineActive && betEntryState.manualLineInput !== '' && betEntryState.lineValue === null));
  updateAddFormState();
}

function activateAddBetSession(session: AddBetSessionState): void {
  editingDraftId = session.editingDraftId;
  currentOpenMatchId = session.matchId;
  currentOpenMatchTitle = session.matchTitle;
  if (session.mode !== 'scoped') {
    currentOpenHomeTeam = '';
    currentOpenAwayTeam = '';
  }
  pendingOngoingDraftId = null;
  pendingOngoingInput = null;
  pendingDisciplineChallenge = null;
  setText('discipline-feedback', '');
  betEntryState = createBetEntryState();
  resolvedRunningMatchId = '';
  renderBetEntryControls();
}

// Removed updateMatchFilters as filtering is done dynamically in renderAppShell before rendering

function setSegmentActive(button: HTMLElement): void {
  const group = button.closest('.segmented');
  if (!group) {
    return;
  }

  group.querySelectorAll('button').forEach((peer) => {
    peer.classList.toggle('active', peer === button);
  });
}

function updateDetailPanel(button: HTMLElement): void {
  const selected = button.dataset.detailTab;
  const betsPanel = document.getElementById('match-detail-panel-bets');
  const infoPanel = document.getElementById('match-detail-panel-info');

  if (betsPanel) {
    betsPanel.hidden = selected !== 'bets';
  }
  if (infoPanel) {
    infoPanel.hidden = selected !== 'info';
  }
}

function toggleMatchCard(button: HTMLElement): void {
  const card = button.closest('[data-match-card]');
  if (!card) {
    return;
  }

  const collapsed = card.classList.toggle('collapsed');
  button.setAttribute('aria-expanded', String(!collapsed));
  button.setAttribute('aria-label', collapsed ? 'Expand match details' : 'Collapse match details');
  button.innerHTML = collapsed
    ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 10 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 14 6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

async function refreshBetRecords(): Promise<void> {
  betRecordsState = await loadBetRecordsViewState();
  updateBetsScreenView();
  updateTodayScreenView();
}

async function refreshBankroll(selectedAccountId?: string): Promise<void> {
  bankrollState = await loadBankrollViewState(fetch, selectedAccountId);
  updateBankrollScreenView();
  updateTodayScreenView();
}

function errorCode(error: unknown): string {
  return error instanceof ApiRequestError ? error.code : 'request_failed';
}

function localAnchorDate(): string {
  return todayLocalDate();
}

async function refreshReports(customParams?: { period: BetReportPeriod; startDate?: string; endDate?: string }): Promise<void> {
  bankrollReportState = { status: 'loading' };
  todayReportState = { status: 'loading' };
  updateBankrollScreenView();
  updateTodayScreenView();
  const accountId = bankrollState.status === 'ready' ? bankrollState.selectedAccountId : undefined;
  const timeZone = disciplineConfigState.status === 'ready' && disciplineConfigState.config
    ? disciplineConfigState.config.timeZone
    : getTargetTimezone();
  const anchor = getLocalDateFromUtc(new Date().toISOString(), timeZone);
  const withAccount = accountId ? { accountId } : {};
  const periodToLoad = customParams?.period ?? reportPeriod;
  const customStart = customParams?.startDate ?? (periodToLoad === 'custom' ? (customRangeStart ?? undefined) : undefined);
  const customEnd = customParams?.endDate ?? (periodToLoad === 'custom' ? (customRangeEnd ?? customRangeStart ?? undefined) : undefined);

  const [bankrollResult, todayResult] = await Promise.allSettled([
    loadBetReport({
      period: periodToLoad,
      anchor,
      timeZone,
      ...(periodToLoad === 'custom' && customStart ? { startDate: customStart } : {}),
      ...(periodToLoad === 'custom' && customEnd ? { endDate: customEnd } : {}),
      ...withAccount
    }),
    loadBetReport({ period: 'week', anchor, timeZone, ...withAccount })
  ]);
  bankrollReportState = bankrollResult.status === 'fulfilled'
    ? (bankrollResult.value.totalSettledBets === 0 && bankrollResult.value.daily.length === 0
        ? { status: 'empty' }
        : { status: 'ready', report: bankrollResult.value })
    : { status: 'unavailable', code: errorCode(bankrollResult.reason) };
  todayReportState = todayResult.status === 'fulfilled'
    ? (todayResult.value.totalSettledBets === 0 && todayResult.value.daily.length === 0
        ? { status: 'empty' }
        : { status: 'ready', report: todayResult.value })
    : { status: 'unavailable', code: errorCode(todayResult.reason) };
  updateBankrollScreenView();
  updateTodayScreenView();
}

async function refreshDisciplineConfig(): Promise<void> {
  disciplineConfigState = { status: 'loading' };
  updateBankrollScreenView();
  updateTodayScreenView();
  try {
    disciplineConfigState = { status: 'ready', config: await loadDisciplineConfig() };
  } catch (error) {
    disciplineConfigState = { status: 'unavailable', code: errorCode(error) };
  }
  await refreshReports();
}

function findDraft(draftId: string | null): AddBetDraft | undefined {
  return draftId && betRecordsState.status === 'ready' ? betRecordsState.drafts.find((draft) => draft.draftId === draftId) : undefined;
}

function populateAddFormFromDraft(draft: AddBetDraft): void {
  const setValue = (id: string, value: string | number | undefined) => {
    const field = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (field) field.value = value == null ? '' : String(value);
  };
  setValue('home-team', draft.homeTeamName);
  setValue('away-team', draft.awayTeamName);
  betEntryState = restoreBetEntryState(draft);
  resolvedRunningMatchId = draft.marketType === 'running' && draft.liveContextSource === 'snapshot'
    ? draft.matchGroupId
    : '';
  renderBetEntryControls();
  setValue('odds-field', draft.oddsValue);
  setValue('stake-field', draft.stakePoints);
  setValue('emotion-field', draft.preBetEmotion);
  setValue('motivation-field', draft.preBetMotivation);
  setValue('pre-bet-plan-adherence', draft.preBetPlanAdherence);
  setValue('note-field', draft.preBetNote ?? draft.notes);
  updateAddFormState();
}

function readOngoingBetInput(form: HTMLFormElement): CreateOngoingBetInput | null {
  const data = new FormData(form);
  const homeTeamName = String(data.get('home-team') ?? '').trim();
  const awayTeamName = String(data.get('away-team') ?? '').trim();
  const structuredSelection = toStructuredBetSelection(betEntryState);
  const oddsValue = Number(data.get('odds-field'));
  const stakePoints = Number(data.get('stake-field'));
  const preBetEmotion = String(data.get('emotion-field') ?? '');
  const preBetMotivation = String(data.get('motivation-field') ?? '');
  const preBetPlanAdherence = String(data.get('pre-bet-plan-adherence') ?? '');
  const preBetNote = String(data.get('note-field') ?? '').trim();
  if (!homeTeamName || !awayTeamName || !structuredSelection || !Number.isFinite(oddsValue) || oddsValue <= 0 || !Number.isFinite(stakePoints) || stakePoints <= 0 || !preBetEmotion || !preBetMotivation || !['yes', 'partly', 'no'].includes(preBetPlanAdherence)) return null;
  if (!/^\d+(?:\.\d{1,4})?$/.test(String(data.get('odds-field')))) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(data.get('stake-field')))) return null;
  const timestamp = new Date().toISOString();
  const effectiveMatchId = currentOpenMatchId || resolvedRunningMatchId;
  if (!effectiveMatchId) return null;
  return {
    betId: crypto.randomUUID(),
    matchGroupId: findDraft(editingDraftId)?.matchGroupId ?? effectiveMatchId,
    matchId: effectiveMatchId,
    homeTeamName, awayTeamName,
    ...structuredSelection,
    oddsFormat: 'HK', oddsValue, stakePoints,
    preBetEmotion: preBetEmotion as CreateOngoingBetInput['preBetEmotion'],
    preBetMotivation: preBetMotivation as CreateOngoingBetInput['preBetMotivation'],
    preBetPlanAdherence: preBetPlanAdherence as CreateOngoingBetInput['preBetPlanAdherence'],
    ...(preBetNote ? { preBetNote } : {}), createdAt: timestamp
  };
}

function startDisciplineCountdown(challenge: DisciplineChallenge): void {
  if (disciplineCountdownTimer !== null) window.clearInterval(disciplineCountdownTimer);
  const update = () => {
    const seconds = Math.max(0, Math.ceil((new Date(challenge.availableAt).getTime() - Date.now()) / 1000));
    const translate = createTranslator(settingsService.getSettings().locale);
    setText('discipline-countdown', seconds > 0 ? translate('bets.availableIn', { seconds }) : translate('common.confirm'));
    const acknowledgement = document.getElementById('discipline-acknowledge') as HTMLInputElement | null;
    const finalize = document.getElementById('discipline-finalize') as HTMLButtonElement | null;
    if (finalize) finalize.disabled = seconds > 0 || !acknowledgement?.checked;
    if (seconds === 0 && disciplineCountdownTimer !== null) {
      window.clearInterval(disciplineCountdownTimer);
      disciplineCountdownTimer = null;
    }
  };
  update();
  disciplineCountdownTimer = window.setInterval(update, 250);
}

function updateSettlementPreview(): void {
  const record = betRecordsState.status === 'ready' ? [...betRecordsState.pending, ...betRecordsState.settled].find((bet) => bet.betId === selectedSettlementBetId) : undefined;
  const typeField = document.getElementById('settlement-type') as HTMLSelectElement | null;
  const manualField = document.getElementById('manual-profit-loss') as HTMLInputElement | null;
  const manualFields = document.getElementById('manual-adjustment-fields');
  if (!record || !typeField) return;
  const settlementType = typeField.value as SettlementType;
  if (manualFields) manualFields.hidden = settlementType !== 'manual_adjustment';
  try {
    const profitLoss = calculateHkSettlementProfitLoss({ stakePoints: record.stakePoints, oddsValue: record.oddsValue, settlementType, ...(settlementType === 'manual_adjustment' ? { profitLossPoints: Number(manualField?.value) } : {}) });
    setText('settlement-preview', `${profitLoss > 0 ? '+' : ''}${profitLoss} pts`);
  } catch {
    setText('settlement-preview', '—');
  }
}

appRoot.addEventListener('click', (event) => {
  const eventTarget = event.target instanceof Element ? event.target : null;
  if (!eventTarget) {
    return;
  }
  const marketChoice = eventTarget.closest<HTMLButtonElement>('[data-bet-market]');
  if (marketChoice?.dataset.betMarket && !marketChoice.disabled) {
    betEntryState = selectBetMarket(betEntryState, marketChoice.dataset.betMarket as CreatableMarketType);
    resolvedRunningMatchId = '';
    if (betEntryState.marketType === 'running') applyRunningSnapshotContext();
    renderBetEntryControls();
    return;
  }
  const runningSourceChoice = eventTarget.closest<HTMLButtonElement>('[data-running-context-source]');
  if (runningSourceChoice?.dataset.runningContextSource === 'manual') {
    betEntryState = setManualRunningContext(betEntryState, {
      liveScoreHome: betEntryState.liveScoreHome,
      liveScoreAway: betEntryState.liveScoreAway,
      liveMinute: betEntryState.liveMinute
    });
    renderBetEntryControls();
    document.getElementById('live-score-home-field')?.focus();
    return;
  }
  if (runningSourceChoice?.dataset.runningContextSource === 'snapshot') {
    applyRunningSnapshotContext();
    renderBetEntryControls();
    return;
  }
  const runningWindowChoice = eventTarget.closest<HTMLButtonElement>('[data-running-window]');
  if (runningWindowChoice?.dataset.runningWindow && !runningWindowChoice.disabled) {
    const runningWindow = runningWindowChoice.dataset.runningWindow as RunningWindow;
    betEntryState = selectRunningWindow(betEntryState, runningWindow, runningWindow === 'fixed_15' ? {
      startMinute: Number(runningWindowChoice.dataset.windowStart),
      endMinute: Number(runningWindowChoice.dataset.windowEnd)
    } : undefined);
    renderBetEntryControls();
    return;
  }
  const periodChoice = eventTarget.closest<HTMLButtonElement>('[data-bet-period]');
  if (periodChoice?.dataset.betPeriod) {
    betEntryState = selectBetPeriod(betEntryState, periodChoice.dataset.betPeriod as MarketPeriod);
    renderBetEntryControls();
    return;
  }
  const selectionChoice = eventTarget.closest<HTMLButtonElement>('[data-bet-selection]');
  if (selectionChoice?.dataset.betSelection) {
    betEntryState = selectBetSelection(betEntryState, selectionChoice.dataset.betSelection as SelectionCode);
    renderBetEntryControls();
    return;
  }
  const lineChoice = eventTarget.closest<HTMLButtonElement>('[data-bet-line]');
  if (lineChoice?.dataset.betLine) {
    betEntryState = selectBetLinePreset(betEntryState, Number(lineChoice.dataset.betLine));
    renderBetEntryControls();
    return;
  }
  if (eventTarget.closest('[data-manual-bet-line]')) {
    betEntryState = enableManualBetLine(betEntryState);
    renderBetEntryControls();
    document.getElementById('manual-bet-line-field')?.focus();
    return;
  }
  if (eventTarget.closest('[data-live-toggle]')) {
    matchesLiveMode.toggle();
    updateMatchesScreenView();
    appRoot.querySelector<HTMLButtonElement>('[data-live-toggle]')?.focus();
    return;
  }

  const betFilterTarget = eventTarget.closest<HTMLElement>('[data-bet-filter]');
  if (betFilterTarget?.dataset.betFilter) {
    betRecordFilter = betFilterTarget.dataset.betFilter as BetRecordFilter;
    updateBetsScreenView();
    return;
  }

  const bankrollViewTarget = eventTarget.closest<HTMLElement>('[data-bankroll-view]');
  if (bankrollViewTarget?.dataset.bankrollView) {
    bankrollView = bankrollViewTarget.dataset.bankrollView as BankrollSecondaryView;
    updateBankrollScreenView();
    if (bankrollView === 'analytics' && bankrollReportState.status !== 'ready') void refreshReports();
    return;
  }

  const reportPeriodTarget = eventTarget.closest<HTMLElement>('[data-report-period]');
  if (reportPeriodTarget?.dataset.reportPeriod) {
    const selected = reportPeriodTarget.dataset.reportPeriod as BetReportPeriod;
    reportPeriod = selected;
    if (selected === 'custom') {
      updateBankrollScreenView();
    } else {
      void refreshReports();
    }
    return;
  }

  const calNavTarget = eventTarget.closest<HTMLElement>('[data-cal-nav]');
  if (calNavTarget?.dataset.calNav) {
    const [yearNum, monthNum] = customCalendarMonth.split('-').map(Number);
    const offset = calNavTarget.dataset.calNav === 'prev' ? -1 : 1;
    const newDate = new Date(yearNum, monthNum - 1 + offset, 1);
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
    customCalendarMonth = `${yyyy}-${mm}`;
    updateBankrollScreenView();
    return;
  }

  const calDateTarget = eventTarget.closest<HTMLElement>('[data-cal-date]');
  if (calDateTarget?.dataset.calDate) {
    const clickedDate = calDateTarget.dataset.calDate;
    if (!customRangeStart) {
      customRangeStart = clickedDate;
      customRangeEnd = null;
    } else if (!customRangeEnd) {
      if (clickedDate === customRangeStart) {
        customRangeStart = null;
        customRangeEnd = null;
      } else if (clickedDate < customRangeStart) {
        customRangeStart = clickedDate;
        customRangeEnd = null;
      } else {
        customRangeEnd = clickedDate;
      }
    } else {
      if (clickedDate === customRangeStart || clickedDate === customRangeEnd) {
        customRangeStart = null;
        customRangeEnd = null;
      } else {
        customRangeStart = clickedDate;
        customRangeEnd = null;
      }
    }
    updateBankrollScreenView();
    return;
  }

  const applyCustomRangeTarget = eventTarget.closest<HTMLElement>('[data-action="apply-custom-range"]');
  if (applyCustomRangeTarget && customRangeStart) {
    const startDate = customRangeStart;
    const endDate = customRangeEnd ?? customRangeStart;
    reportPeriod = 'custom';
    void refreshReports({ period: 'custom', startDate, endDate });
    return;
  }

  if (eventTarget.closest('[data-open-bankroll-setup]')) {
    closeSheets();
    setActiveScreen('bankroll');
    updateUrl('bankroll');
    bankrollView = 'overview';
    updateBankrollScreenView();
    return;
  }

  const openSettlementTarget = eventTarget.closest<HTMLElement>('[data-open-settlement], [data-open-settled-detail]');
  if (openSettlementTarget) {
    selectedSettlementBetId = openSettlementTarget.dataset.openSettlement ?? openSettlementTarget.dataset.openSettledDetail ?? '';
    selectedSettlementTimeline = [];
    openSheet('settlement');
    const record = betRecordsState.status === 'ready' ? [...betRecordsState.pending, ...betRecordsState.settled].find((bet) => bet.betId === selectedSettlementBetId) : undefined;
    const legacyField = document.getElementById('legacy-plan-adherence-field');
    const legacySelect = document.getElementById('plan-adherence') as HTMLSelectElement | null;
    const needsLegacyAdherence = Boolean(record && !record.preBetPlanAdherence && !record.postBetPlanAdherence);
    if (legacyField) legacyField.hidden = !needsLegacyAdherence;
    if (legacySelect) { legacySelect.required = needsLegacyAdherence; legacySelect.value = ''; }
    updateSettlementPreview();
    void loadBetSettlementTimeline(selectedSettlementBetId).then((events) => {
      selectedSettlementTimeline = events;
      const timeline = document.getElementById('settlement-timeline');
      const settings = settingsService.getSettings();
      const timeZone = disciplineConfigState.status === 'ready' && disciplineConfigState.config
        ? disciplineConfigState.config.timeZone
        : Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timeline) timeline.innerHTML = renderSettlementTimeline(events, createTranslator(settings.locale), settings.locale, timeZone);
    }).catch(() => undefined);
    return;
  }

  if (eventTarget.closest('[data-open-settings]')) {
    openSheet('settings');
    const settings = settingsService.getSettings();
    const locale = document.getElementById('settings-locale') as HTMLSelectElement | null;
    const density = document.getElementById('settings-density') as HTMLSelectElement | null;
    const timezone = document.getElementById('settings-timezone') as HTMLSelectElement | null;
    if (locale) locale.value = settings.locale;
    if (density) density.value = settings.displayDensity;
    if (timezone) timezone.value = settings.timezone;
    return;
  }

  if (eventTarget.closest('#discipline-finalize')) {
    const challenge = pendingDisciplineChallenge;
    const input = pendingOngoingInput;
    if (!challenge || !input) return;
    const button = document.getElementById('discipline-finalize') as HTMLButtonElement | null;
    if (button?.disabled) return;
    if (button) button.disabled = true;
    const draftId = pendingOngoingDraftId;
    void createOngoingBet({ ...input, disciplineChallengeId: challenge.challengeId }).then(async () => {
      if (draftId) await deleteCloudBetDraft(draftId);
      pendingDisciplineChallenge = null;
      pendingOngoingInput = null;
      pendingOngoingDraftId = null;
      closeSheets();
      await Promise.all([refreshBetRecords(), refreshBankroll()]);
      await refreshReports();
    }).catch((error) => {
      const translate = createTranslator(settingsService.getSettings().locale);
      setText('discipline-feedback', translate(`error.${errorCode(error)}`, translate('error.request_failed')));
      if (button) button.disabled = false;
    });
    return;
  }

  const deleteDraft = eventTarget.closest<HTMLElement>('[data-delete-draft-confirm]');
  if (deleteDraft?.dataset.deleteDraftConfirm) {
    void deleteCloudBetDraft(deleteDraft.dataset.deleteDraftConfirm).then(refreshBetRecords);
    return;
  }

  const editDraft = eventTarget.closest<HTMLElement>('[data-edit-draft]');
  if (editDraft?.dataset.editDraft) {
    const draft = findDraft(editDraft.dataset.editDraft);
    if (!draft) return;
    const elements = getAddBetFormElements();
    if (!elements) return;
    activateAddBetSession(startAddBetSession('edit', {
      draftId: draft.draftId,
      ...(draft.matchGroupId.startsWith('manual:') ? {} : { matchId: draft.matchGroupId })
    }, elements));
    openSheet('add');
    populateAddFormFromDraft(draft);
    return;
  }

  const ledgerAction = eventTarget.closest<HTMLElement>('[data-ledger-type]');
  if (ledgerAction?.dataset.ledgerType && bankrollState.status === 'ready') {
    openSheet('ledger-adjustment');
    const entryType = document.getElementById('ledger-entry-type') as HTMLSelectElement | null;
    if (entryType) entryType.value = ledgerAction.dataset.ledgerType;
    return;
  }

  // Handle Date Prev Button Click
  const prevBtn = eventTarget.closest<HTMLElement>('#date-prev-btn');
  if (prevBtn) {
    const [year, month, day] = matchFeedState.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    dateObj.setUTCDate(dateObj.getUTCDate() - 1);
    matchFeedState.date = dateObj.toISOString().slice(0, 10);
    void refreshMatchFeed();
    return;
  }

  // Handle Date Next Button Click
  const nextBtn = eventTarget.closest<HTMLElement>('#date-next-btn');
  if (nextBtn) {
    const [year, month, day] = matchFeedState.date.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    dateObj.setUTCDate(dateObj.getUTCDate() + 1);
    matchFeedState.date = dateObj.toISOString().slice(0, 10);
    void refreshMatchFeed();
    return;
  }

  // Handle Date Chip Click
  const dateChipTarget = eventTarget.closest<HTMLElement>('.date-chip');
  if (dateChipTarget) {
    const selectedDate = dateChipTarget.dataset.date;
    if (selectedDate) {
      matchFeedState.date = selectedDate;
      void refreshMatchFeed();
    }
    return;
  }

  // Handle Date Picker Button Click
  const datePickerBtn = eventTarget.closest<HTMLElement>('#date-picker-btn');
  if (datePickerBtn) {
    isMatchesCalendarOpen = !isMatchesCalendarOpen;
    matchesCalendarMonth = matchFeedState.date.slice(0, 7);
    updateMatchesScreenView();
    return;
  }

  // Handle Matches Calendar Navigation
  const matchesCalNav = eventTarget.closest<HTMLElement>('[data-matches-cal-nav]');
  if (matchesCalNav) {
    const navDirection = matchesCalNav.dataset.matchesCalNav;
    const currentM = matchesCalendarMonth || matchFeedState.date.slice(0, 7);
    const [y, m] = currentM.split('-').map(Number);
    const nextD = new Date(y, m - 1 + (navDirection === 'next' ? 1 : -1), 1);
    matchesCalendarMonth = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`;
    updateMatchesScreenView();
    return;
  }

  // Handle Matches Calendar Date Click
  const matchesCalDate = eventTarget.closest<HTMLElement>('[data-matches-cal-date]');
  if (matchesCalDate) {
    const selectedDate = matchesCalDate.dataset.matchesCalDate;
    if (selectedDate) {
      matchFeedState.date = selectedDate;
      isMatchesCalendarOpen = false;
      void refreshMatchFeed();
    }
    return;
  }

  // Handle Filter Button Click
  const filterBtn = eventTarget.closest<HTMLElement>('.filter-button');
  if (filterBtn) {
    isFilterPanelOpen = !isFilterPanelOpen;
    updateMatchesScreenView();
    return;
  }

  const closeTarget = eventTarget.closest('[data-close-sheet]');
  if (closeTarget) {
    closeSheets();
    return;
  }

  const tabTarget = eventTarget.closest<HTMLElement>('[data-tab-target]');
  if (tabTarget) {
    cancelMatchDetailLoad();
    const tabId = getSafeNavigationTabId(tabTarget.dataset.tabTarget);
    setActiveScreen(tabId);
    updateUrl(tabId);
    return;
  }

  const openMatchTarget = eventTarget.closest<HTMLElement>('[data-open-match]');
  if (openMatchTarget) {
    cancelMatchDetailLoad();
    const title = openMatchTarget.dataset.matchTitle || 'Selected match group';
    const meta = openMatchTarget.dataset.matchMeta || 'matchGroupId context';
    const matchId = openMatchTarget.dataset.matchId || '';
    const homeTeamName = openMatchTarget.dataset.homeTeam || '';
    const awayTeamName = openMatchTarget.dataset.awayTeam || '';
    currentOpenMatchId = matchId;
    matchDetailReturnScreen = isPrimaryTabId(currentScreenName) ? currentScreenName : 'today';
    setMatchDetailContext(title, meta, homeTeamName, awayTeamName);
    resetMatchDetailTabs();
    setActiveScreen('match-detail');
    window.history.pushState({ screen: 'match-detail', returnScreen: matchDetailReturnScreen }, '', window.location.href);
    matchDetailState = { status: 'loading' };
    renderMatchDetailState();
    return;
  }

  if (eventTarget.closest('[data-open-scoped-add]')) {
    if (!currentOpenMatchId) return;
    const elements = getAddBetFormElements();
    if (!elements) return;
    activateAddBetSession(startAddBetSession('scoped', {
      matchId: currentOpenMatchId,
      matchTitle: currentOpenMatchTitle,
      homeTeamName: currentOpenHomeTeam,
      awayTeamName: currentOpenAwayTeam
    }, elements));
    openSheet('add');
    return;
  }

  const openSheetTarget = eventTarget.closest<HTMLElement>('[data-open-sheet]');
  if (openSheetTarget) {
    if (openSheetTarget.dataset.openSheet === 'review') {
      setText('review-subtitle', openSheetTarget.dataset.reviewTitle || 'Review row');
    }
    openSheet(openSheetTarget.dataset.openSheet);
    return;
  }

  if (eventTarget.closest('#match-detail-back')) {
    cancelMatchDetailLoad();
    const returnScreen = matchDetailReturnScreen;
    setActiveScreen(returnScreen);
    updateUrl(returnScreen);
    if (window.history.state?.screen === 'match-detail') {
      window.history.back();
    }
    return;
  }

  if (eventTarget.closest('[data-match-detail-retry]')) {
    if (currentOpenMatchId) {
      void loadAndRenderMatchDetail(currentOpenMatchId);
    }
    return;
  }

  const detailTabTarget = eventTarget.closest<HTMLElement>('[data-detail-tab]');
  if (detailTabTarget) {
    setSegmentActive(detailTabTarget);
    updateDetailPanel(detailTabTarget);
    if (detailTabTarget.dataset.detailTab === 'info' && currentOpenMatchId) {
      void loadAndRenderMatchDetail(currentOpenMatchId);
    } else {
      cancelMatchDetailLoad();
    }
    return;
  }

  const toggleMatchTarget = eventTarget.closest<HTMLElement>('[data-toggle-match]');
  if (toggleMatchTarget) {
    toggleMatchCard(toggleMatchTarget);
    return;
  }

  const segmentedButton = eventTarget.closest<HTMLElement>('.segmented button');
  if (segmentedButton) {
    setSegmentActive(segmentedButton);
  }
});

appRoot.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
    return;
  }

  if (target.id === 'manual-bet-line-field') {
    betEntryState = setManualBetLine(betEntryState, target.value);
    renderBetEntryControls();
    return;
  }

  if (['live-score-home-field', 'live-score-away-field', 'live-minute-field'].includes(target.id)) {
    readManualRunningContext();
    renderBetEntryControls();
    return;
  }

  if (target.closest('#add-form')) {
    updateAddFormState();
  }

  if (target.id === 'discipline-acknowledge' && pendingDisciplineChallenge) {
    startDisciplineCountdown(pendingDisciplineChallenge);
  }

  if (target.id === 'settlement-type' || target.id === 'manual-profit-loss') {
    updateSettlementPreview();
  }

  if (target instanceof HTMLInputElement && target.id === 'match-search') {
    currentSearchQuery = target.value;
    updateMatchesScreenView();
  }
});

appRoot.addEventListener('change', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement
    && ['home-team', 'away-team'].includes(target.id)
    && betEntryState.marketType === 'running'
    && betEntryState.liveContextSource !== 'manual') {
    applyRunningSnapshotContext();
    renderBetEntryControls();
    return;
  }
  if (target instanceof HTMLInputElement && target.name === 'filter-groupby') {
    activeFilters.groupby = target.value;
    updateMatchesScreenView();
    return;
  }

  if (target instanceof HTMLInputElement && target.name === 'filter-type') {
    activeFilters.type = target.value;
    updateMatchesScreenView();
    return;
  }

  if (target instanceof HTMLInputElement && target.name === 'filter-gender') {
    activeFilters.gender = target.value;
    updateMatchesScreenView();
    return;
  }

  if (target instanceof HTMLInputElement && target.name === 'filter-league') {
    if (target.checked) {
      activeFilters.selectedLeagues.add(target.value);
    } else {
      activeFilters.selectedLeagues.delete(target.value);
    }
    updateMatchesScreenView();
    return;
  }

  if (target instanceof HTMLElement && target.closest('#add-form')) {
    updateAddFormState();
  }
});

appRoot.addEventListener('submit', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }
  event.preventDefault();

  if (target.id === 'setup-bankroll-form') {
    const form = new FormData(target);
    const openingBalancePoints = Number(form.get('opening'));
    const translate = createTranslator(settingsService.getSettings().locale);
    if (!Number.isFinite(openingBalancePoints) || openingBalancePoints <= 0) { setText('bankroll-setup-feedback', translate('error.validation_failed')); return; }
    void setupBankroll({ openingBalancePoints, timeZone: getTargetTimezone(), weekStartDay: 'monday' }).then(async () => {
      await refreshBankroll();
      await refreshDisciplineConfig();
    }).catch(() => setText('bankroll-setup-feedback', translate('error.request_failed')));
    return;
  }

  if (target.id === 'discipline-form') {
    const form = new FormData(target);
    const nullablePoints = (name: string) => {
      const raw = String(form.get(name) ?? '').trim();
      return raw === '' ? null : Number(raw);
    };
    const weekStartDay = (form.get('weekStartDay') as 'monday' | 'sunday') || 'monday';
    const activeSettings = settingsService.getSettings();
    const resolvedTimeZone = activeSettings.timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : activeSettings.timezone;
    const input = {
      dailyStopLossPoints: nullablePoints('dailyStopLossPoints'),
      weeklyStopLossPoints: nullablePoints('weeklyStopLossPoints'),
      bigBetThresholdPoints: nullablePoints('bigBetThresholdPoints'),
      timeZone: resolvedTimeZone,
      weekStartDay
    };
    void updateDisciplineConfig(input).then(async (config) => {
      disciplineConfigState = { status: 'ready', config };
      setText('discipline-feedback', createTranslator(settingsService.getSettings().locale)('common.save'));
      await refreshReports();
    }).catch((error) => setText('discipline-feedback', createTranslator(settingsService.getSettings().locale)(`error.${errorCode(error)}`, createTranslator(settingsService.getSettings().locale)('error.request_failed'))));
    return;
  }

  if (target.id === 'ledger-adjustment-form' && bankrollState.status === 'ready') {
    const form = new FormData(target);
    const entryType = String(form.get('entryType') ?? '') as 'deposit' | 'withdrawal' | 'correction';
    const rawAmount = Number(form.get('amountPoints'));
    const note = String(form.get('note') ?? '').trim();
    const translate = createTranslator(settingsService.getSettings().locale);
    if (!['deposit', 'withdrawal', 'correction'].includes(entryType) || !Number.isFinite(rawAmount) || rawAmount === 0 || (entryType !== 'correction' && rawAmount < 0)) {
      setText('ledger-feedback', translate('error.validation_failed'));
      return;
    }
    const amountPoints = entryType === 'withdrawal' ? -rawAmount : rawAmount;
    void createLedgerEntry({ entryId: crypto.randomUUID(), accountId: bankrollState.selectedAccountId, entryType, amountPoints, ...(note ? { note } : {}), occurredAt: new Date().toISOString() }).then(async () => {
      closeSheets();
      await refreshBankroll(bankrollState.status === 'ready' ? bankrollState.selectedAccountId : undefined);
    }).catch(() => setText('ledger-feedback', translate('error.request_failed')));
    return;
  }

  if (target.id === 'settings-form') {
    const form = new FormData(target);
    settingsService.setSetting('locale', String(form.get('locale') ?? 'en'));
    settingsService.setSetting('displayDensity', String(form.get('displayDensity') ?? 'standard'));
    settingsService.setSetting('timezone', String(form.get('timezone') ?? 'local'));
    closeSheets();
    matchFeedState.date = todayLocalDate();
    render(currentScreenName, true);
    void refreshMatchFeed();
    if (disciplineConfigState.status === 'ready' && disciplineConfigState.config) {
      const activeSettings = settingsService.getSettings();
      const resolvedTimeZone = activeSettings.timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : activeSettings.timezone;
      void updateDisciplineConfig({
        dailyStopLossPoints: disciplineConfigState.config.dailyStopLossPoints,
        weeklyStopLossPoints: disciplineConfigState.config.weeklyStopLossPoints,
        bigBetThresholdPoints: disciplineConfigState.config.bigBetThresholdPoints,
        timeZone: resolvedTimeZone,
        weekStartDay: disciplineConfigState.config.weekStartDay ?? 'monday'
      }).then(async (config) => {
        disciplineConfigState = { status: 'ready', config };
        await refreshReports();
      });
    } else {
      void refreshReports();
    }
    return;
  }

  if (target.id === 'settlement-form') {
    const form = new FormData(target);
    const settlementType = String(form.get('settlementType') ?? '') as SettlementType;
    const planAdherence = String(form.get('planAdherence') ?? '');
    const lessonNote = String(form.get('lessonNote') ?? '').trim();
    const adjustmentReason = String(form.get('adjustmentReason') ?? '').trim();
    const profitLossPoints = Number(form.get('profitLossPoints'));
    const record = betRecordsState.status === 'ready' ? [...betRecordsState.pending, ...betRecordsState.settled].find((bet) => bet.betId === selectedSettlementBetId) : undefined;
    const needsLegacyAdherence = Boolean(record && !record.preBetPlanAdherence && !record.postBetPlanAdherence);
    if (!record || !settlementType || (needsLegacyAdherence && !['yes', 'partly', 'no'].includes(planAdherence))) return;
    const correctionEventId = record.status === 'settled' ? selectedSettlementTimeline.at(-1)?.settlementEventId : undefined;
    if (record.status === 'settled' && !correctionEventId) {
      setText('settlement-feedback', createTranslator(settingsService.getSettings().locale)('error.request_failed'));
      return;
    }
    void settleCloudBet(record.betId, {
      settlementEventId: crypto.randomUUID(), settlementType,
      ...(needsLegacyAdherence ? { planAdherence: planAdherence as 'yes' | 'partly' | 'no' } : {}),
      ...(lessonNote ? { lessonNote } : {}),
      ...(settlementType === 'manual_adjustment' ? { profitLossPoints, adjustmentReason } : {}),
      effectiveAt: new Date().toISOString(),
      ...(correctionEventId ? { correctsSettlementEventId: correctionEventId } : {})
    }).then(async () => {
      closeSheets();
      await Promise.all([refreshBetRecords(), refreshBankroll(record.bankrollAccountId ?? undefined)]);
      await refreshReports();
    }).catch((error) => setText('settlement-feedback', createTranslator(settingsService.getSettings().locale)(`error.${errorCode(error)}`, createTranslator(settingsService.getSettings().locale)('error.request_failed'))));
    return;
  }

  if (target.id !== 'add-form') return;
  const form = new FormData(target);
  const action = ((event as SubmitEvent).submitter as HTMLButtonElement | null)?.value ?? 'draft';
  const homeTeamName = String(form.get('home-team') ?? '').trim();
  const awayTeamName = String(form.get('away-team') ?? '').trim();
  const structuredSelection = toStructuredBetSelection(betEntryState);
  const oddsValue = Number(form.get('odds-field'));
  const stakePoints = Number(form.get('stake-field'));
  const preBetEmotion = String(form.get('emotion-field') || '') as AddBetDraft['preBetEmotion'];
  const preBetMotivation = String(form.get('motivation-field') || '') as AddBetDraft['preBetMotivation'];
  const preBetPlanAdherence = String(form.get('pre-bet-plan-adherence') || '') as AddBetDraft['preBetPlanAdherence'];
  const notes = String(form.get('note-field') || '').trim();
  const translate = createTranslator(settingsService.getSettings().locale);
  if ((!currentOpenMatchId && !editingDraftId) || !homeTeamName || !awayTeamName || !structuredSelection || !Number.isFinite(oddsValue) || oddsValue <= 0 || !/^\d+(?:\.\d{1,4})?$/.test(String(form.get('odds-field'))) || !Number.isFinite(stakePoints) || stakePoints <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(form.get('stake-field')))) {
    setText('add-feedback', translate('error.validation_failed'));
    return;
  }
  const timestamp = new Date().toISOString();
  if (action === 'draft') {
    const existing = findDraft(editingDraftId);
    const draft: AddBetDraft = { draftId: existing?.draftId ?? crypto.randomUUID(), matchGroupId: existing?.matchGroupId ?? currentOpenMatchId, homeTeamName, awayTeamName, ...structuredSelection, oddsFormat: 'HK', oddsValue, stakePoints, ...(preBetEmotion ? { preBetEmotion } : {}), ...(preBetMotivation ? { preBetMotivation } : {}), ...(preBetPlanAdherence ? { preBetPlanAdherence } : {}), ...(notes ? { preBetNote: notes, notes } : {}), createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp };
    const save = existing ? updateCloudBetDraft(draft) : saveCloudBetDraft(draft);
    void save.then(async () => {
      closeSheets();
      betRecordFilter = 'drafts';
      await refreshBetRecords();
    }).catch(() => setText('add-feedback', translate('error.request_failed')));
    return;
  }
  if (bankrollState.status !== 'ready') {
    setText('add-feedback', translate(bankrollState.status === 'compatibility' ? 'bankroll.compatibilityRequired' : 'bankroll.setupRequired'));
    return;
  }
  const input = readOngoingBetInput(target);
  if (!input) {
    setText('add-feedback', translate('error.validation_failed'));
    return;
  }
  void createDisciplineChallenge(input).then(async (result) => {
    if (result.required) {
      pendingOngoingInput = input;
      pendingDisciplineChallenge = result.challenge;
      pendingOngoingDraftId = editingDraftId;
      openSheet('discipline-challenge');
      startDisciplineCountdown(result.challenge);
      return;
    }
    await createOngoingBet(input);
    if (editingDraftId) await deleteCloudBetDraft(editingDraftId);
    closeSheets();
    betRecordFilter = 'ongoing';
    await Promise.all([refreshBetRecords(), refreshBankroll()]);
    await refreshReports();
  }).catch((error) => setText('add-feedback', translate(`error.${errorCode(error)}`, translate('error.request_failed'))));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSheets();
    return;
  }
  if (event.key === 'Tab') {
    const openSheetElement = appRoot.querySelector<HTMLElement>('.sheet.open[data-focus-trap]');
    if (!openSheetElement) return;
    const focusable = [...openSheetElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
});

window.addEventListener('popstate', () => {
  cancelMatchDetailLoad();
  if (currentScreenName === 'match-detail') {
    const returnScreen = matchDetailReturnScreen;
    setActiveScreen(returnScreen);
    updateUrl(returnScreen);
    return;
  }
  if (isPrimaryTabId(currentScreenName)) {
    updateUrl(currentScreenName);
    return;
  }
});

let edgeSwipeStartX = 0;
let edgeSwipeStartY = 0;
let edgeSwipeTracking = false;

function handleTouchStart(event: TouchEvent): void {
  if (event.touches.length !== 1) {
    edgeSwipeTracking = false;
    return;
  }
  const touch = event.touches[0];
  if (!touch) return;
  if (touch.clientX > 35) {
    edgeSwipeTracking = false;
    return;
  }
  edgeSwipeStartX = touch.clientX;
  edgeSwipeStartY = touch.clientY;
  edgeSwipeTracking = true;
}

function handleTouchMove(event: TouchEvent): void {
  if (!edgeSwipeTracking || event.touches.length !== 1) return;
  const touch = event.touches[0];
  if (!touch) return;
  const deltaX = touch.clientX - edgeSwipeStartX;
  const deltaY = touch.clientY - edgeSwipeStartY;
  if (deltaX < -10 || (Math.abs(deltaY) > 25 && Math.abs(deltaY) > Math.abs(deltaX))) {
    edgeSwipeTracking = false;
  }
}

function handleTouchEnd(event: TouchEvent): void {
  if (!edgeSwipeTracking) return;
  edgeSwipeTracking = false;
  const touch = event.changedTouches[0];
  if (!touch) return;
  const deltaX = touch.clientX - edgeSwipeStartX;
  const deltaY = touch.clientY - edgeSwipeStartY;
  if (deltaX >= 50 && deltaX > Math.abs(deltaY) * 1.5) {
    triggerEdgeSwipeBack();
  }
}

function handleTouchCancel(): void {
  edgeSwipeTracking = false;
}

function triggerEdgeSwipeBack(): void {
  if (appRoot.querySelector('.sheet.open')) return;
  if (isPrimaryTabId(currentScreenName)) return;

  const activeScreen = appRoot.querySelector<HTMLElement>('.screen.active');
  if (!activeScreen) return;

  const backButton = activeScreen.querySelector<HTMLElement>('.back-button, #match-detail-back, [data-screen-back]');
  if (backButton) {
    backButton.click();
  }
}

window.addEventListener('touchstart', handleTouchStart, { passive: true });
window.addEventListener('touchmove', handleTouchMove, { passive: true });
window.addEventListener('touchend', handleTouchEnd, { passive: true });
window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

async function refreshMatchFeed(): Promise<void> {
  activeFilters.selectedLeagues.clear();
  const date = matchFeedState.date;
  const tz = getTargetTimezone();
  matchFeedState = { status: 'loading', date };
  updateTodayScreenView();
  updateMatchesScreenView();
  const result = await getMatchFeed(date, tz);
  if (matchFeedState.date === date) {
    matchFeedState = result;
    updateTodayScreenView();
    updateMatchesScreenView();
  }
}

async function refreshLiveMatchView(reason: 'visible' | 'manual'): Promise<void> {
  const requestVersion = ++liveMatchRequestVersion;
  const result = await refreshLiveMatches(reason);
  if (requestVersion !== liveMatchRequestVersion) return;
  liveMatchState = retainLastGoodLive(liveMatchState, result);
  updateMatchesScreenView();
}

function bindCurrentPullDownRefresh(): void {
  unbindPullDownRefresh?.();
  const scroll = document.getElementById('main-scroll');
  if (!scroll) return;
  unbindPullDownRefresh = bindPullDownRefresh(scroll, {
    canPull: () => currentScreenName === 'matches',
    onRefresh: () => {
      const indicator = document.getElementById('pull-refresh-indicator');
      if (indicator) {
        indicator.classList.add('refreshing');
      }
      Promise.all([refreshLiveMatchView('manual'), refreshMatchFeed()]).finally(() => {
        if (indicator) {
          indicator.classList.remove('refreshing');
          indicator.dataset.pullProgress = '0';
          indicator.style.setProperty('--pull-progress', '0');
        }
      });
    },
    onProgress: (progress) => {
      const indicator = document.getElementById('pull-refresh-indicator');
      if (!indicator) return;
      indicator.dataset.pullProgress = String(progress);
      indicator.style.setProperty('--pull-progress', String(progress));
    }
  });
}

// Replace the public startup placeholders and unlock controls only after session verification.
render(getInitialTabId(), true);
const liveRefreshLifecycle = createLiveRefreshLifecycle({
  documentTarget: document,
  windowTarget: window,
  refresh: () => refreshLiveMatchView('visible')
});
liveRefreshLifecycle.start();
void refreshMatchFeed();
void refreshBetRecords();
void refreshBankroll();
void refreshDisciplineConfig();
