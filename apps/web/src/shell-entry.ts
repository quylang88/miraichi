import { getSafeNavigationTabId, type ProductionNavigationTabId } from './config/navigation-tabs.js';
import { renderAppShell } from './components/app-shell.js';
import { createSettingsService } from './services/settings-service.js';
import { t } from './services/i18n-service.js';
import { getMatchFeed, type MatchFeedViewState } from './services/match-feed-service.js';

const root = document.getElementById('app-root');

if (!root) {
  throw new Error('Missing app-root element for Miraichi production shell.');
}

const appRoot = root;
const settingsService = createSettingsService();

let currentScreenName = 'today';
let matchDetailReturnScreen: ProductionNavigationTabId = 'today';
let currentSearchQuery = '';
let isLiveFilterActive = false;

const activeFilters = {
  groupby: 'league',
  type: 'all',
  gender: 'all',
  selectedLeagues: new Set<string>()
};
let isFilterPanelOpen = false;
let currentOpenMatchId = '';

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

  appRoot.innerHTML = renderAppShell({
    activeTabId: safeActiveTabId,
    translate: t,
    matchFeed: matchFeedState,
    timezone: settingsService.getSettings().timezone,
    filters: activeFilters,
    searchQuery: currentSearchQuery,
    isLiveFilterActive,
    isFilterPanelOpen
  });
  appRoot.querySelector('.app-shell')?.setAttribute('data-locale', settingsService.getSettings().locale);

  // Restore filter values and apply
  const searchInput = appRoot.querySelector('#match-search') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = currentSearchQuery;
  }
  const liveFilterBtn = appRoot.querySelector('#live-filter-btn') as HTMLElement | null;
  if (liveFilterBtn && isLiveFilterActive) {
    liveFilterBtn.classList.add('active');
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

  let found = false;
  appRoot.querySelectorAll<HTMLElement>('.sheet').forEach((sheet) => {
    const open = sheet.id === `${sheetName}-sheet`;
    found = found || open;
    sheet.classList.toggle('open', open);
    sheet.setAttribute('aria-hidden', String(!open));
  });

  if (!found) {
    return;
  }

  appRoot.querySelector<HTMLElement>('.sheet-backdrop')?.classList.add('open');
  appRoot.querySelector<HTMLElement>('.app-shell')?.classList.add('sheet-open');
}

function closeSheets(): void {
  appRoot.querySelectorAll<HTMLElement>('.sheet').forEach((sheet) => {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  });
  appRoot.querySelector<HTMLElement>('.sheet-backdrop')?.classList.remove('open');
  appRoot.querySelector<HTMLElement>('.app-shell')?.classList.remove('sheet-open');
  setText('add-feedback', '');
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

appRoot.addEventListener('click', (event) => {
  const eventTarget = event.target instanceof Element ? event.target : null;
  if (!eventTarget) {
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

  // Handle LIVE Filter Button Click
  const liveFilterTarget = eventTarget.closest<HTMLElement>('#live-filter-btn');
  if (liveFilterTarget) {
    isLiveFilterActive = !isLiveFilterActive;
    render(currentScreenName);
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
    return;
  }

  const openEditTarget = eventTarget.closest<HTMLElement>('[data-open-edit]');
  if (openEditTarget) {
    setText('edit-subtitle', openEditTarget.dataset.editTitle || 'Ongoing record');
    openSheet('edit');
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

  if (target instanceof HTMLInputElement && target.id === 'match-search') {
    currentSearchQuery = target.value;
    render(currentScreenName);
  }
});

appRoot.addEventListener('change', (event) => {
  const target = event.target;
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
  if (!(target instanceof HTMLFormElement) || target.id !== 'add-form') {
    return;
  }

  event.preventDefault();
  const saveDraftShell = document.getElementById('save-draft-shell') as HTMLButtonElement | null;
  if (saveDraftShell?.disabled) {
    return;
  }
  setText('add-feedback', 'Shell only: draft validated, no data saved.');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSheets();
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
