import { getSafeNavigationTabId, type ProductionNavigationTabId } from './config/navigation-tabs.js';
import { renderAppShell } from './components/app-shell.js';
import { createSettingsService } from './services/settings-service.js';
import { createTranslator } from './services/i18n-service.js';
import { getMatchFeed, type MatchFeedViewState } from './services/match-feed-service.js';
import { deleteCloudBetDraft, loadBetRecordsViewState, saveCloudBetDraft, type BetRecordsViewState } from './services/bet-record-service.js';
import { createBankrollAccount, createBankrollTransfer, createLedgerEntry, loadBankrollViewState, type BankrollViewState } from './services/bankroll-service.js';
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
import { calculateHkSettlementProfitLoss, type BetSettlementEvent, type CreateOngoingBetInput, type DisciplineChallenge, type SettlementType } from '@miraichi/shared';
import { renderSettlementTimeline, type BetRecordFilter } from './components/screens/bets-screen.js';
import type { BankrollSecondaryView } from './components/screens/bankroll-screen.js';

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
let betRecordsState: BetRecordsViewState = { status: 'loading' };
let bankrollState: BankrollViewState = { status: 'loading' };
let betRecordFilter: BetRecordFilter = 'ongoing';
let bankrollView: BankrollSecondaryView = 'overview';
let disciplineConfigState: DisciplineConfigViewState = { status: 'loading' };
let bankrollReportState: BetReportViewState = { status: 'loading' };
let todayReportState: BetReportViewState = { status: 'loading' };
let reportPeriod: BetReportPeriod = 'week';
let selectedSettlementBetId = '';
let selectedSettlementTimeline: readonly BetSettlementEvent[] = [];
let pendingOngoingInput: CreateOngoingBetInput | null = null;
let pendingDisciplineChallenge: DisciplineChallenge | null = null;
let disciplineCountdownTimer: number | null = null;
let lastFocusedElement: HTMLElement | null = null;

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let matchFeedState: MatchFeedViewState = {
  status: 'loading',
  date: todayLocalDate()
};

function getInitialTabId(): ProductionNavigationTabId {
  const params = new URLSearchParams(window.location.search);
  return getSafeNavigationTabId(params.get('tab') || 'today');
}

function isPrimaryTabId(value: string): value is ProductionNavigationTabId {
  return getSafeNavigationTabId(value) === value;
}

function render(activeTabId: string): void {
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
  appRoot.innerHTML = renderAppShell({
    activeTabId: safeActiveTabId,
    translate,
    locale: settings.locale,
    matchFeed: matchFeedState,
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
    reportPeriod
  });
  appRoot.querySelector('.app-shell')?.setAttribute('data-locale', settings.locale);
  appRoot.querySelector('.app-shell')?.setAttribute('data-density', settings.displayDensity);

  // Restore filter values and apply
  const searchInput = appRoot.querySelector('#match-search') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = currentSearchQuery;
  }
  // Restore focus state
  if (activeElementId) {
    const elementToFocus = document.getElementById(activeElementId);
    if (elementToFocus) {
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
  window.history.pushState({ tabId }, '', url);
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}
const API_BASE_URL = (typeof window !== 'undefined' && (window as Window & { MIRAICHI_ENV?: { API_URL?: string } }).MIRAICHI_ENV?.API_URL) || '';

function escapeText(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderEventIcon(type: string): string {
  if (type === 'Goal') return '⚽';
  if (type === 'Card') return '🟨';
  if (type === 'subst') return '🔄';
  return '📋';
}

async function loadAndRenderMatchDetail(matchId: string): Promise<void> {
  const infoPanel = document.getElementById('match-detail-panel-info');
  if (!infoPanel) return;

  infoPanel.innerHTML = '<p class="match-info-loading">Loading match details…</p>';

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/matches/detail?id=${encodeURIComponent(matchId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as {
      match: { homeTeam: { name: string }; awayTeam: { name: string }; score: { home: number | null; away: number | null }; kickoffUtc: string; venue?: string };
      events?: Array<{ minute: number | null; type: 'goal' | 'card' | 'substitution' | 'penalty' | 'other'; teamId?: string; label: string }>;
      notes?: string[];
    };

    const m = data.match;
    const home = m.homeTeam.name;
    const away = m.awayTeam.name;
    const score = (m.score && m.score.home !== null) ? `${m.score.home} – ${m.score.away}` : '– –';
    const kickoff = m.kickoffUtc ? new Date(m.kickoffUtc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const venue = m.venue ? ` · ${m.venue}` : '';

    const events = Array.isArray(data.events) ? data.events : [];
    const eventsHtml = events.length === 0
      ? '<p class="match-info-error">No events recorded.</p>'
      : events.map(ev => `
        <div class="match-event-item">
          <span class="match-event-icon">${renderEventIcon(ev.type)}</span>
          <span class="match-event-time">${ev.minute ?? ''}'</span>
          <div class="match-event-detail">
            <div class="match-event-player">${escapeText(ev.label)}</div>
          </div>
        </div>
      `).join('');

    const notes = Array.isArray(data.notes) ? data.notes : [];
    const notesHtml = notes.length === 0
      ? ''
      : `<div class="match-info-notes">${notes.map(n => `<p>${escapeText(n)}</p>`).join('')}</div>`;

    infoPanel.innerHTML = `
      <div class="match-info-card">
        <div class="match-info-scoreline">
          <div class="match-info-team">${escapeText(home)}</div>
          <div class="match-info-score">${score}</div>
          <div class="match-info-team">${escapeText(away)}</div>
        </div>
        <div class="match-info-meta">
          <span>${escapeText(kickoff)}</span>${venue ? `<span>${escapeText(venue)}</span>` : ''}
        </div>
        <div class="match-event-timeline">${eventsHtml}</div>
        ${notesHtml}
      </div>
    `;
  } catch {
    infoPanel.innerHTML = '<p class="match-info-error">Could not load match details. Try again later.</p>';
  }
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

function setMatchDetailContext(title: string, meta: string): void {
  currentOpenMatchTitle = title;
  setText('match-detail-title', title);
  setText('match-detail-meta', meta);
  setText('add-sheet-subtitle', `Scoped to ${title}`);
  setText('add-summary-title', title);
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
  lastFocusedElement?.focus();
  lastFocusedElement = null;
}

function updateAddFormState(): void {
  const addForm = document.getElementById('add-form');
  const saveDraftShell = document.getElementById('save-draft-shell') as HTMLButtonElement | null;
  const oddsField = document.getElementById('odds-field') as HTMLInputElement | null;
  const stakeField = document.getElementById('stake-field') as HTMLInputElement | null;

  if (!(addForm instanceof HTMLFormElement) || !saveDraftShell || !oddsField || !stakeField) {
    return;
  }

  const formData = new FormData(addForm);
  const market = formData.get('market-field');
  const odds = oddsField.value.trim();
  const stake = stakeField.value.trim();
  saveDraftShell.disabled = !(market && odds && stake);
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
  render(currentScreenName);
}

async function refreshBankroll(selectedAccountId?: string): Promise<void> {
  bankrollState = await loadBankrollViewState(fetch, selectedAccountId);
  render(currentScreenName);
}

function errorCode(error: unknown): string {
  return error instanceof ApiRequestError ? error.code : 'request_failed';
}

function localAnchorDate(): string {
  return todayLocalDate();
}

async function refreshReports(): Promise<void> {
  if (disciplineConfigState.status !== 'ready' || !disciplineConfigState.config) {
    const state: BetReportViewState = { status: 'unavailable', code: 'discipline_config_required' };
    bankrollReportState = state;
    todayReportState = state;
    render(currentScreenName);
    return;
  }
  bankrollReportState = { status: 'loading' };
  todayReportState = { status: 'loading' };
  render(currentScreenName);
  const accountId = bankrollState.status === 'ready' ? bankrollState.selectedAccountId : undefined;
  const withAccount = accountId ? { accountId } : {};
  const [bankrollResult, todayResult] = await Promise.allSettled([
    loadBetReport({ period: reportPeriod, anchor: localAnchorDate(), ...withAccount }),
    loadBetReport({ period: 'week', anchor: localAnchorDate(), ...withAccount })
  ]);
  bankrollReportState = bankrollResult.status === 'fulfilled'
    ? { status: 'ready', report: bankrollResult.value }
    : { status: 'unavailable', code: errorCode(bankrollResult.reason) };
  todayReportState = todayResult.status === 'fulfilled'
    ? { status: 'ready', report: todayResult.value }
    : { status: 'unavailable', code: errorCode(todayResult.reason) };
  render(currentScreenName);
}

async function refreshDisciplineConfig(): Promise<void> {
  disciplineConfigState = { status: 'loading' };
  render(currentScreenName);
  try {
    disciplineConfigState = { status: 'ready', config: await loadDisciplineConfig() };
  } catch (error) {
    disciplineConfigState = { status: 'unavailable', code: errorCode(error) };
  }
  await refreshReports();
}

function manualMatchGroupId(homeTeamName: string, awayTeamName: string): string {
  return `manual:${homeTeamName.trim().toLowerCase()}-${awayTeamName.trim().toLowerCase()}`;
}

function readOngoingBetInput(form: HTMLFormElement): CreateOngoingBetInput | null {
  const data = new FormData(form);
  const homeTeamName = String(data.get('home-team') ?? '').trim();
  const awayTeamName = String(data.get('away-team') ?? '').trim();
  const bankrollAccountId = String(data.get('account-field') ?? '').trim();
  const marketType = String(data.get('market-field') ?? '');
  const selectionLabel = String(data.get('selection-field') ?? '').trim();
  const oddsValue = Number(data.get('odds-field'));
  const stakePoints = Number(data.get('stake-field'));
  const preBetEmotion = String(data.get('emotion-field') ?? '');
  const preBetMotivation = String(data.get('motivation-field') ?? '');
  const preBetNote = String(data.get('note-field') ?? '').trim();
  if (!homeTeamName || !awayTeamName || !bankrollAccountId || !marketType || !selectionLabel || !Number.isFinite(oddsValue) || oddsValue <= 0 || !Number.isFinite(stakePoints) || stakePoints <= 0 || !preBetEmotion || !preBetMotivation) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(data.get('stake-field')))) return null;
  const timestamp = new Date().toISOString();
  return {
    betId: crypto.randomUUID(), bankrollAccountId,
    matchGroupId: currentOpenMatchId || manualMatchGroupId(homeTeamName, awayTeamName),
    ...(currentOpenMatchId ? { matchId: currentOpenMatchId } : {}),
    homeTeamName, awayTeamName,
    marketType: marketType as CreateOngoingBetInput['marketType'], selectionLabel,
    oddsFormat: 'HK', oddsValue, stakePoints,
    preBetEmotion: preBetEmotion as CreateOngoingBetInput['preBetEmotion'],
    preBetMotivation: preBetMotivation as CreateOngoingBetInput['preBetMotivation'],
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

  const betFilterTarget = eventTarget.closest<HTMLElement>('[data-bet-filter]');
  if (betFilterTarget?.dataset.betFilter) {
    betRecordFilter = betFilterTarget.dataset.betFilter as BetRecordFilter;
    render(currentScreenName);
    return;
  }

  const bankrollViewTarget = eventTarget.closest<HTMLElement>('[data-bankroll-view]');
  if (bankrollViewTarget?.dataset.bankrollView) {
    bankrollView = bankrollViewTarget.dataset.bankrollView as BankrollSecondaryView;
    render(currentScreenName);
    if (bankrollView === 'analytics' && bankrollReportState.status !== 'ready') void refreshReports();
    return;
  }

  const reportPeriodTarget = eventTarget.closest<HTMLElement>('[data-report-period]');
  if (reportPeriodTarget?.dataset.reportPeriod) {
    reportPeriod = reportPeriodTarget.dataset.reportPeriod as BetReportPeriod;
    void refreshReports();
    return;
  }

  if (eventTarget.closest('[data-open-manual-add]')) {
    currentOpenMatchId = '';
    currentOpenMatchTitle = '';
    openSheet('add');
    setText('add-summary-title', createTranslator(settingsService.getSettings().locale)('bets.manualMatch'));
    return;
  }

  const openSettlementTarget = eventTarget.closest<HTMLElement>('[data-open-settlement], [data-open-settled-detail]');
  if (openSettlementTarget) {
    selectedSettlementBetId = openSettlementTarget.dataset.openSettlement ?? openSettlementTarget.dataset.openSettledDetail ?? '';
    selectedSettlementTimeline = [];
    openSheet('settlement');
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

  if (eventTarget.closest('[data-open-transfer]')) {
    openSheet('transfer');
    const target = document.getElementById('transfer-target') as HTMLSelectElement | null;
    if (target && bankrollState.status === 'ready') {
      const selectedAccountId = bankrollState.selectedAccountId;
      const option = [...target.options].find((item) => item.value !== selectedAccountId);
      if (option) target.value = option.value;
    }
    return;
  }

  if (eventTarget.closest('[data-open-settings]')) {
    openSheet('settings');
    const settings = settingsService.getSettings();
    const locale = document.getElementById('settings-locale') as HTMLSelectElement | null;
    const density = document.getElementById('settings-density') as HTMLSelectElement | null;
    if (locale) locale.value = settings.locale;
    if (density) density.value = settings.displayDensity;
    return;
  }

  if (eventTarget.closest('#discipline-finalize')) {
    const challenge = pendingDisciplineChallenge;
    const input = pendingOngoingInput;
    if (!challenge || !input) return;
    const button = document.getElementById('discipline-finalize') as HTMLButtonElement | null;
    if (button?.disabled) return;
    if (button) button.disabled = true;
    void createOngoingBet({ ...input, disciplineChallengeId: challenge.challengeId }).then(async () => {
      pendingDisciplineChallenge = null;
      pendingOngoingInput = null;
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
    const dateObj = new Date(year, month - 1, day);
    dateObj.setDate(dateObj.getDate() - 1);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    matchFeedState.date = `${yyyy}-${mm}-${dd}`;
    void refreshMatchFeed();
    return;
  }

  // Handle Date Next Button Click
  const nextBtn = eventTarget.closest<HTMLElement>('#date-next-btn');
  if (nextBtn) {
    const [year, month, day] = matchFeedState.date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    dateObj.setDate(dateObj.getDate() + 1);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    matchFeedState.date = `${yyyy}-${mm}-${dd}`;
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
    const input = document.getElementById('date-picker-input') as HTMLInputElement | null;
    if (input) {
      if (typeof input.showPicker === 'function') {
        try {
          input.showPicker();
        } catch {
          input.click();
        }
      } else {
        input.click();
      }
    }
    return;
  }

  // Handle Filter Button Click
  const filterBtn = eventTarget.closest<HTMLElement>('.filter-button');
  if (filterBtn) {
    isFilterPanelOpen = !isFilterPanelOpen;
    render(currentScreenName);
    return;
  }

  const closeTarget = eventTarget.closest('[data-close-sheet]');
  if (closeTarget) {
    closeSheets();
    return;
  }

  const tabTarget = eventTarget.closest<HTMLElement>('[data-tab-target]');
  if (tabTarget) {
    const tabId = getSafeNavigationTabId(tabTarget.dataset.tabTarget);
    render(tabId);
    updateUrl(tabId);
    return;
  }

  const openMatchTarget = eventTarget.closest<HTMLElement>('[data-open-match]');
  if (openMatchTarget) {
    const title = openMatchTarget.dataset.matchTitle || 'Selected match group';
    const meta = openMatchTarget.dataset.matchMeta || 'matchGroupId context';
    const matchId = openMatchTarget.dataset.matchId || '';
    currentOpenMatchId = matchId;
    matchDetailReturnScreen = isPrimaryTabId(currentScreenName) ? currentScreenName : 'today';
    setMatchDetailContext(title, meta);
    resetMatchDetailTabs();
    setActiveScreen('match-detail');
    if (matchId) {
      void loadAndRenderMatchDetail(matchId);
    }
    return;
  }

  if (eventTarget.closest('[data-open-scoped-add]')) {
    openSheet('add');
    const [home = '', away = ''] = currentOpenMatchTitle.split(' vs ');
    const homeInput = document.getElementById('home-team') as HTMLInputElement | null;
    const awayInput = document.getElementById('away-team') as HTMLInputElement | null;
    if (homeInput) homeInput.value = home;
    if (awayInput) awayInput.value = away;
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
    setActiveScreen(matchDetailReturnScreen);
    return;
  }

  const detailTabTarget = eventTarget.closest<HTMLElement>('[data-detail-tab]');
  if (detailTabTarget) {
    setSegmentActive(detailTabTarget);
    updateDetailPanel(detailTabTarget);
    // If switching to info tab and we have a match id, load detail
    if (detailTabTarget.dataset.detailTab === 'info' && currentOpenMatchId) {
      void loadAndRenderMatchDetail(currentOpenMatchId);
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
    render(currentScreenName);
  }
});

appRoot.addEventListener('change', (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.matches('[data-bankroll-account-select]')) {
    void refreshBankroll(target.value);
    return;
  }
  if (target instanceof HTMLInputElement && target.name === 'filter-groupby') {
    activeFilters.groupby = target.value;
    render(currentScreenName);
    return;
  }

  if (target instanceof HTMLInputElement && target.name === 'filter-type') {
    activeFilters.type = target.value;
    render(currentScreenName);
    return;
  }

  if (target instanceof HTMLInputElement && target.name === 'filter-gender') {
    activeFilters.gender = target.value;
    render(currentScreenName);
    return;
  }

  if (target instanceof HTMLInputElement && target.name === 'filter-league') {
    if (target.checked) {
      activeFilters.selectedLeagues.add(target.value);
    } else {
      activeFilters.selectedLeagues.delete(target.value);
    }
    render(currentScreenName);
    return;
  }

  if (target instanceof HTMLInputElement && target.id === 'date-picker-input') {
    const selectedDate = target.value;
    if (selectedDate) {
      matchFeedState.date = selectedDate;
      void refreshMatchFeed();
    }
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

  if (target.id === 'create-bankroll-form') {
    const form = new FormData(target);
    const label = String(form.get('label') || '').trim();
    const openingBalancePoints = Number(form.get('opening'));
    if (!label || !Number.isFinite(openingBalancePoints)) return;
    void createBankrollAccount({ accountId: crypto.randomUUID(), label, openingBalancePoints }).then(() => refreshBankroll());
    return;
  }

  if (target.id === 'discipline-form') {
    const form = new FormData(target);
    const nullablePoints = (name: string) => {
      const raw = String(form.get(name) ?? '').trim();
      return raw === '' ? null : Number(raw);
    };
    const input = {
      dailyStopLossPoints: nullablePoints('dailyStopLossPoints'),
      weeklyStopLossPoints: nullablePoints('weeklyStopLossPoints'),
      bigBetThresholdPoints: nullablePoints('bigBetThresholdPoints'),
      timeZone: String(form.get('timeZone') ?? '').trim()
    };
    void updateDisciplineConfig(input).then(async (config) => {
      disciplineConfigState = { status: 'ready', config };
      setText('discipline-feedback', createTranslator(settingsService.getSettings().locale)('common.save'));
      await refreshReports();
    }).catch((error) => setText('discipline-feedback', createTranslator(settingsService.getSettings().locale)(`error.${errorCode(error)}`, createTranslator(settingsService.getSettings().locale)('error.request_failed'))));
    return;
  }

  if (target.id === 'transfer-form' && bankrollState.status === 'ready') {
    const form = new FormData(target);
    const toAccountId = String(form.get('toAccountId') ?? '');
    const amountPoints = Number(form.get('amountPoints'));
    const note = String(form.get('note') ?? '').trim();
    if (!toAccountId || toAccountId === bankrollState.selectedAccountId || !Number.isFinite(amountPoints) || amountPoints <= 0) return;
    void createBankrollTransfer({ transferId: crypto.randomUUID(), fromAccountId: bankrollState.selectedAccountId, toAccountId, amountPoints, ...(note ? { note } : {}), occurredAt: new Date().toISOString() }).then(async () => {
      closeSheets();
      await refreshBankroll(bankrollState.status === 'ready' ? bankrollState.selectedAccountId : undefined);
    });
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
    closeSheets();
    render(currentScreenName);
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
    if (!record || !settlementType || !['yes', 'partly', 'no'].includes(planAdherence)) return;
    const correctionEventId = record.status === 'settled' ? selectedSettlementTimeline.at(-1)?.settlementEventId : undefined;
    if (record.status === 'settled' && !correctionEventId) {
      setText('settlement-feedback', createTranslator(settingsService.getSettings().locale)('error.request_failed'));
      return;
    }
    void settleCloudBet(record.betId, {
      settlementEventId: crypto.randomUUID(), settlementType,
      planAdherence: planAdherence as 'yes' | 'partly' | 'no',
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
  const marketType = String(form.get('market-field') || '');
  const oddsValue = Number(form.get('odds-field'));
  const stakePoints = Number(form.get('stake-field'));
  const notes = String(form.get('note-field') || '').trim();
  const translate = createTranslator(settingsService.getSettings().locale);
  if (!homeTeamName || !awayTeamName || !marketType || !Number.isFinite(oddsValue) || !Number.isFinite(stakePoints) || stakePoints <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(form.get('stake-field')))) {
    setText('add-feedback', translate('error.validation_failed'));
    return;
  }
  const timestamp = new Date().toISOString();
  if (action === 'draft') {
    void saveCloudBetDraft({ draftId: crypto.randomUUID(), matchGroupId: currentOpenMatchId || manualMatchGroupId(homeTeamName, awayTeamName), marketType: marketType as '1X2' | 'over_under' | 'handicap' | 'corners' | 'custom', oddsFormat: 'HK', oddsValue, stakePoints, ...(notes ? { notes } : {}), createdAt: timestamp, updatedAt: timestamp }).then(async () => {
      closeSheets();
      betRecordFilter = 'drafts';
      await refreshBetRecords();
    }).catch(() => setText('add-feedback', translate('error.request_failed')));
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
      openSheet('discipline-challenge');
      startDisciplineCountdown(result.challenge);
      return;
    }
    await createOngoingBet(input);
    closeSheets();
    betRecordFilter = 'ongoing';
    await Promise.all([refreshBetRecords(), refreshBankroll(input.bankrollAccountId)]);
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
  render(getInitialTabId());
});

async function refreshMatchFeed(): Promise<void> {
  activeFilters.selectedLeagues.clear();
  const date = matchFeedState.date;
  matchFeedState = { status: 'loading', date };
  render(currentScreenName);
  const result = await getMatchFeed(date);
  if (matchFeedState.date === date) {
    matchFeedState = result;
    render(currentScreenName);
  }
}

render(getInitialTabId());
void refreshMatchFeed();
void refreshBetRecords();
void refreshBankroll();
void refreshDisciplineConfig();
