import { getSafeNavigationTabId, type ProductionNavigationTabId } from './config/navigation-tabs.js';
import { renderAppShell } from './components/app-shell.js';
import { createSettingsService } from './services/settings-service.js';
import { t } from './services/i18n-service.js';

const root = document.getElementById('app-root');

if (!root) {
  throw new Error('Missing app-root element for Miraichi production shell.');
}

const appRoot = root;
const settingsService = createSettingsService();

let currentScreenName = 'today';
let matchDetailReturnScreen: ProductionNavigationTabId = 'today';

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
  appRoot.innerHTML = renderAppShell({
    activeTabId: safeActiveTabId,
    translate: t
  });
  appRoot.querySelector('.app-shell')?.setAttribute('data-locale', settingsService.getSettings().locale);
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
  const savePreview = document.getElementById('save-preview') as HTMLButtonElement | null;
  const oddsField = document.getElementById('odds-field') as HTMLInputElement | null;
  const stakeField = document.getElementById('stake-field') as HTMLInputElement | null;

  if (!(addForm instanceof HTMLFormElement) || !savePreview || !oddsField || !stakeField) {
    return;
  }

  const formData = new FormData(addForm);
  const market = formData.get('market-field');
  const odds = oddsField.value.trim();
  const stake = stakeField.value.trim();
  savePreview.disabled = !(market && odds && stake);
}

function updateMatchSearch(searchInput: HTMLInputElement): void {
  const query = searchInput.value.trim().toLowerCase();
  const rows = Array.from(appRoot.querySelectorAll<HTMLElement>('[data-match-row]'));
  const matchesEmpty = document.getElementById('matches-empty');
  let visibleCount = 0;

  rows.forEach((row) => {
    const visible = (row.textContent ?? '').toLowerCase().includes(query);
    row.style.display = visible ? '' : 'none';
    if (visible) {
      visibleCount += 1;
    }
  });

  if (matchesEmpty) {
    matchesEmpty.style.display = visibleCount === 0 ? 'block' : 'none';
  }
}

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
    matchDetailReturnScreen = isPrimaryTabId(currentScreenName) ? currentScreenName : 'today';
    setMatchDetailContext(title, meta);
    resetMatchDetailTabs();
    setActiveScreen('match-detail');
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
    updateMatchSearch(target);
  }
});

appRoot.addEventListener('change', (event) => {
  const target = event.target;
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
  const savePreview = document.getElementById('save-preview') as HTMLButtonElement | null;
  if (savePreview?.disabled) {
    return;
  }
  setText('add-feedback', 'Shell only: mock draft validated, no data saved.');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSheets();
  }
});

window.addEventListener('popstate', () => {
  render(getInitialTabId());
});

render(getInitialTabId());
