import {
  getSafeNavigationTabId,
  navigationTabs,
  type NavigationTab,
  type ProductionNavigationTabId
} from '../config/navigation-tabs.js';
import { t, type TranslateFunction } from '../services/i18n-service.js';
import { renderBottomNavigation } from './bottom-navigation.js';
import { escapeHtml } from './html.js';
import type { AppMatch, MatchFeedViewState } from '../services/match-feed-service.js';
import { NATIONAL_COMPETITION_KEYWORDS } from '../../../../packages/config/src/competition-registry.mock.js';

const icons = Object.freeze({
  back: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 6-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 4.8A1.8 1.8 0 0 1 8.8 3h6.4A1.8 1.8 0 0 1 17 4.8V21l-5-3-5 3V4.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19V9M10 19V5M15 19v-7M20 19H4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  document: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h7l4 4v14H7V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h4M9.5 13h5M9.5 16h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 10 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v4M12 17v4M4.2 6.2l2.8 2.8M17 17l2.8 2.8M3 12h4M17 12h4M4.2 17.8 7 15M17 7l2.8-2.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  time: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.8"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 14 6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
});

export function getTodayDateTileParts(date = new Date()): { readonly day: string; readonly month: string } {
  return {
    day: String(date.getDate()),
    month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date).toUpperCase()
  };
}

export interface RibbonDate {
  readonly dateStr: string;
  readonly dayNumber: string;
  readonly label: string;
}

export function getRibbonDates(selectedDateStr: string): readonly RibbonDate[] {
  const [year, month, day] = selectedDateStr.split('-').map(Number);
  const centerDate = new Date(year, month - 1, day);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ribbon: RibbonDate[] = [];

  for (let i = -2; i <= 2; i++) {
    const d = new Date(centerDate);
    d.setDate(centerDate.getDate() + i);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const compareDate = new Date(d);
    compareDate.setHours(0, 0, 0, 0);
    const diffTime = compareDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    let label = '';
    if (diffDays === 0) {
      label = 'Today';
    } else if (diffDays === -1) {
      label = 'Yesterday';
    } else if (diffDays === 1) {
      label = 'Tomorrow';
    } else {
      label = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
    }

    ribbon.push({
      dateStr,
      dayNumber: String(d.getDate()),
      label
    });
  }

  return ribbon;
}

function getScreenClass(tabId: ProductionNavigationTabId, activeTabId: ProductionNavigationTabId): string {
  return tabId === activeTabId ? 'screen active' : 'screen';
}

const defaultMatchFeed: MatchFeedViewState = Object.freeze({
  status: 'loading',
  date: new Date().toISOString().slice(0, 10)
});

function formatKickoffTime(isoValue: string, timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh' = 'local'): string {
  const date = new Date(isoValue);
  if (isNaN(date.getTime())) {
    return isoValue || '--:--';
  }
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  if (timezone !== 'local') {
    options.timeZone = timezone;
  }
  try {
    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch {
    return isoValue || '--:--';
  }
}

function matchTitle(match: AppMatch): string {
  return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
}

function matchMeta(match: AppMatch, timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh' = 'local'): string {
  const suffix = timezone === 'local' ? '' : ` ${timezone}`;
  const score = match.score ? `Score ${match.score.home}-${match.score.away}` : `Kickoff ${formatKickoffTime(match.kickoffTime, timezone)}${suffix}`;
  const round = match.round ? ` · ${match.round}` : '';
  return `${match.competitionName}${round} · ${score} · ${match.statusLabel}`;
}

function renderFeedUnavailable(feed: Extract<MatchFeedViewState, { status: 'unavailable' }>): string {
  return `
    <section class="note-card warning" data-match-feed-state="unavailable">
      <div class="note-eyebrow">Provider setup required</div>
      <div class="note-title">API-Football match feed is unavailable.</div>
      <p class="note-copy">${escapeHtml(feed.reason)}</p>
    </section>
  `;
}

function renderFeedLoading(feed: Extract<MatchFeedViewState, { status: 'loading' }>): string {
  return `
    <section class="note-card" data-match-feed-state="loading">
      <div class="note-eyebrow">API-Football</div>
      <div class="note-title">Loading match feed</div>
      <p class="note-copy">Fetching owner-only matchday fixtures for ${escapeHtml(feed.date)}.</p>
    </section>
  `;
}

function renderFeedEmpty(feed: Extract<MatchFeedViewState, { status: 'empty' }>): string {
  return `
    <section class="note-card" data-match-feed-state="empty">
      <div class="note-eyebrow">API-Football</div>
      <div class="note-title">No fixtures found for ${escapeHtml(feed.date)}.</div>
      <p class="note-copy">The provider returned an empty fixture list for this date.</p>
    </section>
  `;
}

function renderProviderMatchCard(match: AppMatch, timezone?: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  const title = matchTitle(match);
  const meta = matchMeta(match, timezone);
  const statusClass = match.status === 'in_play' ? 'blue' : match.status === 'completed' ? '' : 'amber';
  return `
    <article class="match-card" data-match-card data-provider-match-id="${escapeHtml(match.id)}">
      <div class="match-main clickable" data-open-match
        data-match-title="${escapeHtml(title)}" data-match-meta="${escapeHtml(meta)}"
        data-provider-fixture-id="${escapeHtml(match.providerFixtureId)}"
        role="button" tabindex="0">
        <div class="match-topline">
          <div class="tag-row">
            <span class="tag ${statusClass}">${escapeHtml(match.statusLabel)}</span>
            <span class="tag">${escapeHtml(match.competitionName)}</span>
          </div>
          <div class="row-actions">
            <button class="icon-button" type="button" data-toggle-match aria-expanded="true" aria-label="Collapse ${escapeHtml(title)}">${icons.up}</button>
          </div>
        </div>
        <h3 class="match-title">${escapeHtml(title)}</h3>
        <p class="match-meta">${escapeHtml(meta)}</p>
      </div>
      <div class="ledger-detail">
        <div class="ledger-row">
          <div>
            <div class="ledger-title">Provider fixture</div>
            <div class="ledger-meta">API-Football fixture ${escapeHtml(match.providerFixtureId)}. No odds or prediction loaded.</div>
          </div>
          <span class="ledger-state">${escapeHtml(match.status)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderRowRight(match: AppMatch, timezone?: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  if (match.status === 'completed' && match.score) {
    return `<span class="row-score">${match.score.home} – ${match.score.away}</span>`;
  }
  if (match.status === 'in_play') {
    const scoreStr = match.score ? `${match.score.home} – ${match.score.away}` : '– –';
    const elapsed = match.elapsedMinute != null ? `${match.elapsedMinute}'` : 'LIVE';
    return `<span class="row-score live"><span class="live-dot"></span>${elapsed} ${scoreStr}</span>`;
  }
  return `<span class="row-kickoff">${formatKickoffTime(match.kickoffTime, timezone)}</span>`;
}

function renderProviderMatchRow(match: AppMatch, timezone?: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  const title = matchTitle(match);
  const meta = matchMeta(match, timezone);
  const right = renderRowRight(match, timezone);
  return renderMatchRow(title, right, meta, match.status, match.providerFixtureId);
}

function renderMatchFeedCards(feed: MatchFeedViewState, timezone?: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  if (feed.status === 'loading') return renderFeedLoading(feed);
  if (feed.status === 'unavailable') return renderFeedUnavailable(feed);
  if (feed.status === 'empty') return renderFeedEmpty(feed);
  return feed.matches.map(m => renderProviderMatchCard(m, timezone)).join('');
}

function renderMatchFeedRows(feed: MatchFeedViewState, timezone?: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  if (feed.status === 'loading') return renderFeedLoading(feed);
  if (feed.status === 'unavailable') return renderFeedUnavailable(feed);
  if (feed.status === 'empty') return renderFeedEmpty(feed);
  return feed.matches.map(m => renderProviderMatchRow(m, timezone)).join('');
}

function renderSummaryRow({
  icon,
  title,
  meta,
  value,
  small = false
}: {
  readonly icon: string;
  readonly title: string;
  readonly meta: string;
  readonly value: string;
  readonly small?: boolean;
}): string {
  return `
    <div class="summary-row">
      <div class="summary-icon" aria-hidden="true">${icon}</div>
      <div class="summary-copy">
        <div class="summary-title">${escapeHtml(title)}</div>
        <div class="summary-meta">${escapeHtml(meta)}</div>
      </div>
      <div class="summary-value${small ? ' small' : ''}">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderScreenHeader({
  label,
  title,
  titleId,
  aside = ''
}: {
  readonly label: string;
  readonly title: string;
  readonly titleId: string;
  readonly aside?: string;
}): string {
  return `
    <div class="screen-header">
      <div>
        <p class="screen-label">${escapeHtml(label)}</p>
        <h1 class="screen-title" id="${escapeHtml(titleId)}">${escapeHtml(title)}</h1>
      </div>
      ${aside}
    </div>
  `;
}

function renderTodayPanel(
  activeTabId: ProductionNavigationTabId,
  translate: TranslateFunction,
  matchFeed: MatchFeedViewState,
  timezone?: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'
): string {
  const todayDateTile = getTodayDateTileParts();

  return `
    <section class="${getScreenClass('today', activeTabId)}" id="screen-today" data-shell-tab-panel="today" aria-labelledby="today-title">
      ${renderScreenHeader({
        label: translate('today.eyebrow', 'Today command center'),
        title: translate('today.title', 'Today'),
        titleId: 'today-title',
        aside: `<div class="date-tile" aria-label="Current date ${todayDateTile.day} ${todayDateTile.month}"><span class="date-day">${todayDateTile.day}</span><span class="date-month">${todayDateTile.month}</span></div>`
      })}

      <div class="summary-list" aria-label="Today summary">
        ${renderSummaryRow({
          icon: icons.time,
          title: 'Pending',
          meta: 'Journal rows waiting for review',
          value: '2'
        })}
        ${renderSummaryRow({
          icon: icons.bookmark,
          title: 'Watchlist',
          meta: 'Matches saved for later',
          value: '4'
        })}
        ${renderSummaryRow({
          icon: icons.document,
          title: 'Points snapshot',
          meta: 'Manual ledger. No formula run.',
          value: 'Static',
          small: true
        })}
      </div>

      <div class="segmented" role="tablist" aria-label="Today filter">
        <button class="active" type="button">Pending</button>
        <button type="button">Settled</button>
        <button type="button">Live</button>
        <button type="button">Market</button>
      </div>

      <div class="section-heading">
        <h2>Match Snapshot</h2>
        <span>Markets today</span>
      </div>

      <div class="stack">
        ${renderMatchFeedCards(matchFeed, timezone)}

        <section class="note-card">
          <div class="note-eyebrow">Miraichi note</div>
          <div class="note-title">This shell is a journal surface, not an advice engine.</div>
          <p class="note-copy">The match feed can show provider fixture context, but this shell does not rank picks, estimate confidence, or propose stake size.</p>
        </section>
      </div>
    </section>
  `;
}

function isNationalMatch(competitionName: string): boolean {
  const comp = competitionName.toLowerCase();
  return NATIONAL_COMPETITION_KEYWORDS.some(keyword => comp.includes(keyword));
}

function isWomenMatch(match: AppMatch): boolean {
  const comp = match.competitionName.toLowerCase();
  const home = match.homeTeam.name.toLowerCase();
  const away = match.awayTeam.name.toLowerCase();
  const check = (str: string) => {
    if (str.includes('women') || str.includes('wmn')) return true;
    return /\s+w\b/i.test(str);
  };
  return check(comp) || check(home) || check(away);
}

function renderMatchesPanel(
  activeTabId: ProductionNavigationTabId,
  translate: TranslateFunction,
  matchFeed: MatchFeedViewState,
  timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh' = 'local',
  filters: {
    groupby: string;
    type: string;
    gender: string;
    selectedLeagues: Set<string>;
  } = {
    groupby: 'league',
    type: 'all',
    gender: 'all',
    selectedLeagues: new Set<string>()
  },
  searchQuery = '',
  isLiveFilterActive = false,
  isFilterPanelOpen = false
): string {
  const ribbonDates = getRibbonDates(matchFeed.date);
  const datesHtml = ribbonDates
    .map((rd) => {
      const activeClass = rd.dateStr === matchFeed.date ? ' active' : '';
      return `
        <button class="date-chip${activeClass}" type="button" data-date="${escapeHtml(rd.dateStr)}">
          <span class="date-chip-label">${escapeHtml(rd.label)}</span>
          <span class="date-chip-number">${escapeHtml(rd.dayNumber)}</span>
        </button>
      `;
    })
    .join('');

  let filteredMatches = matchFeed.status === 'ready' ? matchFeed.matches : [];

  // 1. LIVE filter
  if (isLiveFilterActive) {
    filteredMatches = filteredMatches.filter(m => m.status === 'in_play');
  }

  // 2. Search query (case-insensitive substring on team names)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredMatches = filteredMatches.filter(m =>
      m.homeTeam.name.toLowerCase().includes(q) ||
      m.awayTeam.name.toLowerCase().includes(q)
    );
  }

  // 3. Competition Type
  if (filters.type === 'national') {
    filteredMatches = filteredMatches.filter(m => isNationalMatch(m.competitionName));
  } else if (filters.type === 'club') {
    filteredMatches = filteredMatches.filter(m => !isNationalMatch(m.competitionName));
  }

  // 4. Gender
  if (filters.gender === 'women') {
    filteredMatches = filteredMatches.filter(m => isWomenMatch(m));
  } else if (filters.gender === 'men') {
    filteredMatches = filteredMatches.filter(m => !isWomenMatch(m));
  }

  // 5. Selected leagues
  if (filters.selectedLeagues && filters.selectedLeagues.size > 0) {
    filteredMatches = filteredMatches.filter(m => filters.selectedLeagues.has(m.competitionName));
  }

  const uniqueLeagues = matchFeed.status === 'ready'
    ? Array.from(new Set(matchFeed.matches.map(m => m.competitionName))).sort()
    : [];

  const leaguesHtml = uniqueLeagues.map(league => {
    const isChecked = filters.selectedLeagues.has(league) ? 'checked' : '';
    const escapedLeague = escapeHtml(league);
    return `
      <label class="filter-option" for="filter-league-${escapedLeague}">
        <input type="checkbox" id="filter-league-${escapedLeague}" name="filter-league" value="${escapedLeague}" ${isChecked}>
        <span>${escapedLeague}</span>
      </label>
    `;
  }).join('');

  let matchesHtml = '';
  if (matchFeed.status === 'ready') {
    if (filteredMatches.length > 0) {
      if (filters.groupby === 'league') {
        const groups: Record<string, AppMatch[]> = {};
        for (const match of filteredMatches) {
          if (!groups[match.competitionName]) {
            groups[match.competitionName] = [];
          }
          groups[match.competitionName].push(match);
        }

        const sortedLeagues = Object.keys(groups).sort();
        matchesHtml = sortedLeagues.map(league => {
          const leagueMatches = groups[league].sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime));
          return `
            <div class="date-group">
              <div class="group-label">${escapeHtml(league)}</div>
              ${leagueMatches.map(m => renderProviderMatchRow(m, timezone)).join('')}
            </div>
          `;
        }).join('');
      } else {
        // groupby time: sort all by kickoffTime
        const sortedMatches = [...filteredMatches].sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime));
        matchesHtml = `
          <div class="date-group">
            <div class="group-label">${escapeHtml(matchFeed.date)}</div>
            ${sortedMatches.map(m => renderProviderMatchRow(m, timezone)).join('')}
          </div>
        `;
      }
    }
  } else {
    if (matchFeed.status === 'loading') matchesHtml = renderFeedLoading(matchFeed);
    else if (matchFeed.status === 'unavailable') matchesHtml = renderFeedUnavailable(matchFeed);
    else if (matchFeed.status === 'empty') matchesHtml = renderFeedEmpty(matchFeed);
  }

  return `
    <style>
      .date-navigator {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        padding: var(--spacing-sm) 0;
        border-bottom: 1px solid var(--border-color-subtle);
        margin-bottom: var(--spacing-md);
        width: 100%;
      }

      .nav-arrow-btn, .calendar-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-control);
        background: var(--surface-color-secondary);
        border: 1px solid var(--border-color-strong);
        color: var(--text-color-primary);
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.2s, border-color 0.2s;
        padding: 0;
      }

      .nav-arrow-btn:hover, .calendar-btn:hover {
        background: var(--surface-color-tertiary);
        border-color: var(--text-color-muted);
      }

      .nav-arrow-btn svg, .calendar-btn svg {
        width: 20px;
        height: 20px;
      }

      .date-ribbon {
        display: flex;
        gap: var(--spacing-xs);
        overflow-x: auto;
        flex-grow: 1;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .date-ribbon::-webkit-scrollbar {
        display: none;
      }

      .date-chip {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1 0 54px;
        height: 48px;
        border-radius: var(--radius-control);
        background: var(--surface-color-secondary);
        border: 1px solid var(--border-color-strong);
        color: var(--text-color-muted);
        cursor: pointer;
        transition: all 0.2s ease-in-out;
        padding: var(--spacing-xxs) var(--spacing-xs);
      }

      .date-chip:hover {
        background: var(--surface-color-tertiary);
        color: var(--text-color-primary);
      }

      .date-chip.active {
        background: var(--accent-color-primary);
        border-color: var(--accent-color-primary);
        color: #ffffff;
        font-weight: 600;
      }

      .date-chip-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
        opacity: 0.8;
      }

      .date-chip.active .date-chip-label {
        opacity: 1;
      }

      .date-chip-number {
        font-size: 1.05rem;
        line-height: 1.1;
      }

      #screen-matches .search-row {
        grid-template-columns: 1fr auto auto;
      }

      #live-filter-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 var(--spacing-md);
        height: 42px;
        border-radius: var(--radius-control);
        background: var(--surface-color-secondary);
        border: 1px solid var(--border-color-strong);
        color: var(--text-color-muted);
        font-weight: bold;
        font-size: 0.8rem;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      #live-filter-btn:hover {
        background: var(--surface-color-tertiary);
        color: var(--text-color-primary);
      }

      #live-filter-btn.active {
        background: var(--accent-color-danger-soft);
        border-color: var(--accent-color-danger);
        color: var(--accent-color-danger);
        box-shadow: 0 0 8px rgba(255, 69, 58, 0.2);
      }

      .filter-panel {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--spacing-md);
        padding: var(--spacing-md);
        background: var(--surface-color-secondary);
        border: 1px solid var(--border-color-strong);
        border-radius: var(--radius-control);
        margin-top: var(--spacing-xs);
        margin-bottom: var(--spacing-md);
        transition: all 0.3s ease-in-out;
        width: 100%;
        box-sizing: border-box;
      }

      .filter-panel[hidden] {
        display: none !important;
      }

      .filter-group {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }

      .filter-group.full-width {
        grid-column: 1 / -1;
      }

      .filter-group-title {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-color-muted);
        margin-bottom: 2px;
      }

      .filter-options {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
      }

      .filter-option {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-xs);
        padding: var(--spacing-xs) var(--spacing-sm);
        background: var(--surface-color-primary);
        border: 1px solid var(--border-color-strong);
        border-radius: var(--radius-control);
        cursor: pointer;
        font-size: 0.85rem;
        color: var(--text-color-primary);
        transition: all 0.2s ease;
        user-select: none;
      }

      .filter-option:hover {
        background: var(--surface-color-tertiary);
        border-color: var(--text-color-muted);
      }

      .filter-option input[type="radio"],
      .filter-option input[type="checkbox"] {
        margin: 0;
        cursor: pointer;
        accent-color: var(--accent-color-primary);
      }

      .leagues-checklist {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-xs);
        max-height: 150px;
        overflow-y: auto;
        padding-right: var(--spacing-xs);
        scrollbar-width: thin;
      }

      .leagues-checklist::-webkit-scrollbar {
        width: 4px;
      }

      .leagues-checklist::-webkit-scrollbar-thumb {
        background: var(--border-color-strong);
        border-radius: 2px;
      }
    </style>

    <section class="${getScreenClass('matches', activeTabId)}" id="screen-matches" data-shell-tab-panel="matches" aria-labelledby="matches-title">
      ${renderScreenHeader({
        label: translate('matches.eyebrow', 'Browse'),
        title: translate('matches.title', 'Matches'),
        titleId: 'matches-title'
      })}

      <div class="date-navigator">
        <button id="date-prev-btn" class="nav-arrow-btn" type="button" aria-label="Previous day">
          ${icons.back}
        </button>
        <div class="date-ribbon">
          ${datesHtml}
        </div>
        <button id="date-next-btn" class="nav-arrow-btn" type="button" aria-label="Next day">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button id="date-picker-btn" class="calendar-btn" type="button" aria-label="Pick date">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </button>
        <input id="date-picker-input" type="date" style="position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none;" value="${escapeHtml(matchFeed.date)}">
      </div>

      <div class="search-row">
        <input class="search-input" id="match-search" type="search" placeholder="Search generic teams" aria-label="Search generic teams">
        <button id="live-filter-btn" type="button">LIVE</button>
        <button class="filter-button" id="filter-panel-toggle-btn" type="button" aria-label="Open match filters">${icons.filter}</button>
      </div>

      <div class="filter-panel" id="matches-filter-panel" ${isFilterPanelOpen ? '' : 'hidden'}>
        <div class="filter-group">
          <span class="filter-group-title">Sort & Group</span>
          <div class="filter-options">
            <label class="filter-option" for="filter-groupby-league">
              <input type="radio" id="filter-groupby-league" name="filter-groupby" value="league" ${filters.groupby === 'league' ? 'checked' : ''}>
              <span>League</span>
            </label>
            <label class="filter-option" for="filter-groupby-time">
              <input type="radio" id="filter-groupby-time" name="filter-groupby" value="time" ${filters.groupby === 'time' ? 'checked' : ''}>
              <span>Time</span>
            </label>
          </div>
        </div>

        <div class="filter-group">
          <span class="filter-group-title">Competition Type</span>
          <div class="filter-options">
            <label class="filter-option" for="filter-type-all">
              <input type="radio" id="filter-type-all" name="filter-type" value="all" ${filters.type === 'all' ? 'checked' : ''}>
              <span>All</span>
            </label>
            <label class="filter-option" for="filter-type-national">
              <input type="radio" id="filter-type-national" name="filter-type" value="national" ${filters.type === 'national' ? 'checked' : ''}>
              <span>National</span>
            </label>
            <label class="filter-option" for="filter-type-club">
              <input type="radio" id="filter-type-club" name="filter-type" value="club" ${filters.type === 'club' ? 'checked' : ''}>
              <span>Club</span>
            </label>
          </div>
        </div>

        <div class="filter-group">
          <span class="filter-group-title">Gender</span>
          <div class="filter-options">
            <label class="filter-option" for="filter-gender-all">
              <input type="radio" id="filter-gender-all" name="filter-gender" value="all" ${filters.gender === 'all' ? 'checked' : ''}>
              <span>All</span>
            </label>
            <label class="filter-option" for="filter-gender-men">
              <input type="radio" id="filter-gender-men" name="filter-gender" value="men" ${filters.gender === 'men' ? 'checked' : ''}>
              <span>Men</span>
            </label>
            <label class="filter-option" for="filter-gender-women">
              <input type="radio" id="filter-gender-women" name="filter-gender" value="women" ${filters.gender === 'women' ? 'checked' : ''}>
              <span>Women</span>
            </label>
          </div>
        </div>

        <div class="filter-group full-width">
          <span class="filter-group-title">Leagues</span>
          <div id="filter-leagues-list" class="leagues-checklist">
            ${leaguesHtml}
          </div>
        </div>
      </div>

      ${matchesHtml}

      <div class="empty-state" id="matches-empty" style="display: ${matchFeed.status === 'ready' && filteredMatches.length === 0 ? 'block' : 'none'};">No provider matches match this search.</div>
    </section>
  `;
}

function renderMatchRow(title: string, rightHtml: string, detailMeta: string, status?: string, providerFixtureId?: string): string {
  const statusAttr = status ? ` data-status="${escapeHtml(status)}"` : '';
  const fixtureAttr = providerFixtureId ? ` data-provider-fixture-id="${escapeHtml(providerFixtureId)}"` : '';
  return `
    <article class="match-row clickable" data-match-row${statusAttr}${fixtureAttr}
      data-open-match data-match-title="${escapeHtml(title)}" data-match-meta="${escapeHtml(detailMeta)}"
      role="button" tabindex="0">
      <div class="row-split">
        <div class="row-title">${escapeHtml(title)}</div>
        <div class="row-right">${rightHtml}</div>
      </div>
    </article>
  `;
}

function renderBetsPanel(activeTabId: ProductionNavigationTabId, translate: TranslateFunction): string {
  return `
    <section class="${getScreenClass('bets', activeTabId)}" id="screen-bets" data-shell-tab-panel="bets" aria-labelledby="bets-title">
      ${renderScreenHeader({
        label: translate('bets.eyebrow', 'Record management'),
        title: translate('bets.title', 'Bets'),
        titleId: 'bets-title'
      })}

      <div class="segmented three" role="tablist" aria-label="Bet record filter">
        <button class="active" type="button">Ongoing</button>
        <button type="button">Drafts</button>
        <button type="button">Settled</button>
      </div>

      <div class="stack">
        ${renderBetRow('Team Alpha win', 'Ongoing &middot; Team Alpha vs Team Beta &middot; Odds 2.10 &middot; Stake 100 pts', '<button class="text-button" type="button" data-open-edit data-edit-title="Team Alpha win">Edit</button>')}
        ${renderBetRow('Totals draft', 'Team Gamma vs Team Delta &middot; Needs market confirmation', '<button class="text-button" type="button" data-open-edit data-edit-title="Totals draft">Edit</button>')}
        <article class="note-card warning">
          <div class="note-eyebrow">Boundary</div>
          <div class="note-title">Ongoing records can be edited here; settled records are review-only in this shell.</div>
          <p class="note-copy">Adding a new record starts from a match group so the shell stays aligned with matchGroupId grouping. No storage, settlement, or formula is run.</p>
        </article>
      </div>
    </section>
  `;
}

function renderBetRow(title: string, meta: string, actionHtml: string): string {
  return `
    <article class="bet-row">
      <div class="row-split">
        <div>
          <div class="row-title">${escapeHtml(title)}</div>
          <div class="row-meta">${meta}</div>
        </div>
        ${actionHtml}
      </div>
    </article>
  `;
}

function renderMatchDetailPanel(): string {
  return `
    <section class="screen" id="screen-match-detail" aria-labelledby="match-detail-title">
      <button class="secondary-button back-button" type="button" id="match-detail-back">
        ${icons.back}
        Back
      </button>

      <div class="screen-header">
        <div>
          <p class="screen-label">Match group</p>
          <h1 class="screen-title" id="match-detail-title">Team Alpha vs Team Beta</h1>
          <p class="screen-subtitle" id="match-detail-meta">Kickoff 18:00 (Mkt) &middot; matchGroupId: group-alpha-beta</p>
        </div>
      </div>

      <div class="match-context" aria-label="Selected match group context">
        <div class="context-line">
          <div class="context-label">Grouping key</div>
          <div class="context-value">matchGroupId</div>
        </div>
        <div class="context-line">
          <div class="context-label">Entry rule</div>
          <div class="context-value">Add through this match</div>
        </div>
      </div>

      <div class="segmented two" role="tablist" aria-label="Match detail tabs">
        <button class="active" type="button" data-detail-tab="bets">Bets</button>
        <button type="button" data-detail-tab="info">Info</button>
      </div>

      <div class="detail-panel" id="match-detail-panel-bets">
        <div class="action-row">
          <button class="primary-button add-inline" type="button" data-open-scoped-add data-add-bet-boundary="planned">
            ${icons.plus}
            Add Bet
          </button>
        </div>

        <div class="stack">
          ${renderBetRow('Team Alpha win', 'Ongoing &middot; Odds 2.10 &middot; Stake 100 pts', '<button class="text-button" type="button" data-open-edit data-edit-title="Team Alpha win">Edit</button>')}
          ${renderBetRow('Settled context row', 'Review-only shell. No settlement math.', '<button class="text-button" type="button" data-open-sheet="review" data-review-only data-review-title="Settled context row">Review</button>')}
        </div>
      </div>

      <div class="detail-panel" id="match-detail-panel-info" hidden>
        <section class="note-card">
          <div class="note-eyebrow">Match detail boundary</div>
          <div class="note-title">This sub-view is context, not a new primary tab.</div>
          <p class="note-copy">The selected match group supplies the Add Bet context. Feed match linking remains optional and no automatic grouping or merge logic runs here.</p>
        </section>
      </div>
    </section>
  `;
}

function renderBankrollPanel(activeTabId: ProductionNavigationTabId, translate: TranslateFunction): string {
  return `
    <section class="${getScreenClass('bankroll', activeTabId)}" id="screen-bankroll" data-shell-tab-panel="bankroll" aria-labelledby="bankroll-title">
      ${renderScreenHeader({
        label: translate('bankroll.eyebrow', 'Points-only shell'),
        title: translate('bankroll.title', 'Bankroll'),
        titleId: 'bankroll-title'
      })}

      <div class="points-grid">
        ${renderPointsRow('Current points', '24,500 pts', 'Static')}
        ${renderPointsRow('Source', 'Manual ledger', 'Manual')}
        ${renderPointsRow('Formula status', 'Not run', 'Blocked')}
      </div>

      <section class="note-card warning">
        <div class="note-eyebrow">Shell boundary</div>
        <div class="note-title">No charts are shown here because charts can imply real calculation.</div>
        <p class="note-copy">If charts return later, they must be explicitly marked static or backed by a separate approved formula and data plan.</p>
      </section>
    </section>
  `;
}

function renderPointsRow(label: string, value: string, state: string): string {
  return `
    <div class="points-row">
      <div>
        <div class="points-label">${escapeHtml(label)}</div>
        <div class="points-value">${escapeHtml(value)}</div>
      </div>
      <div class="points-state">${escapeHtml(state)}</div>
    </div>
  `;
}

function renderMiraichiPanel(activeTabId: ProductionNavigationTabId, translate: TranslateFunction): string {
  return `
    <section class="${getScreenClass('miraichi', activeTabId)}" id="screen-miraichi" data-shell-tab-panel="miraichi" aria-labelledby="miraichi-title">
      ${renderScreenHeader({
        label: translate('miraichi.eyebrow', 'Assistant surface'),
        title: translate('miraichi.title', 'Miraichi'),
        titleId: 'miraichi-title'
      })}

      <div class="stack">
        ${renderAssistantRow('Context check', 'Static note: generic match data is incomplete. No recommendation is produced.')}
        ${renderAssistantRow('Draft review queue', 'One manual row can be reviewed by the user. No ranking, confidence, or stake advice.')}
        <article class="note-card" data-settings-entry="miraichi-tab">
          <div class="note-eyebrow">Role</div>
          <div class="note-title">Miraichi explains context; it does not decide bets.</div>
          <p class="note-copy">This keeps the assistant UX aligned with the existing AI and betting guardrails while still showing a useful app surface.</p>
        </article>
        <button type="button" class="secondary-button add-inline" data-settings-entry="miraichi-tab">Settings</button>
        <div class="settings-summary" data-settings-summary>
          ${escapeHtml(translate('settings.summary', 'Language and appearance settings are shell-only until later phases.'))}
        </div>
      </div>
    </section>
  `;
}

function renderAssistantRow(title: string, meta: string): string {
  return `
    <article class="assistant-row">
      <div class="row-icon" aria-hidden="true">${icons.spark}</div>
      <div>
        <div class="row-title">${escapeHtml(title)}</div>
        <div class="row-meta">${escapeHtml(meta)}</div>
      </div>
    </article>
  `;
}

function renderSheets(): string {
  return `
    <div class="sheet-backdrop" data-close-sheet></div>

    <section class="sheet" id="add-sheet" aria-hidden="true" aria-labelledby="add-sheet-title" role="dialog">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <div class="sheet-header">
        <div>
          <h2 class="sheet-title" id="add-sheet-title">Add Bet</h2>
          <p class="sheet-subtitle" id="add-sheet-subtitle">Scoped to Team Alpha vs Team Beta</p>
        </div>
        <button class="icon-button" type="button" data-close-sheet aria-label="Close Add Bet sheet">${icons.close}</button>
      </div>
      <div class="sheet-body">
        <form class="form-grid" id="add-form" novalidate>
          <div class="readonly-summary" id="match-summary-readonly" aria-label="Selected match summary">
            <div class="context-line">
              <div class="context-label">Selected match</div>
              <div class="context-value" id="add-summary-title">Team Alpha vs Team Beta</div>
            </div>
            <div class="context-line">
              <div class="context-label">Scope</div>
              <div class="context-value">matchGroupId context</div>
            </div>
          </div>
          <div class="field">
            <label for="market-field">Market</label>
            <select class="field-select" id="market-field" name="market-field" required>
              <option value="">Select market</option>
              <option value="1X2">Market 1X2</option>
              <option value="Totals">Totals</option>
              <option value="Manual note">Manual note</option>
            </select>
          </div>
          <div class="field">
            <label for="odds-field">Odds</label>
            <input class="field-input" id="odds-field" name="odds-field" inputmode="decimal" placeholder="Example: 2.10" required>
          </div>
          <div class="field">
            <label for="stake-field">Stake points</label>
            <input class="field-input" id="stake-field" name="stake-field" inputmode="numeric" placeholder="Example: 100" required>
          </div>
          <div class="field">
            <label for="note-field">User note</label>
            <textarea class="field-textarea" id="note-field" name="note-field" placeholder="Optional context note"></textarea>
          </div>
          <div class="sheet-actions">
            <button class="secondary-button" type="button" data-close-sheet>Cancel</button>
            <button class="primary-button" id="save-draft-shell" type="submit" disabled>Save Draft</button>
          </div>
          <div class="sheet-feedback" id="add-feedback" aria-live="polite"></div>
        </form>
      </div>
    </section>

    <section class="sheet" id="edit-sheet" aria-hidden="true" aria-labelledby="edit-sheet-title" role="dialog">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <div class="sheet-header">
        <div>
          <h2 class="sheet-title" id="edit-sheet-title">Edit Ongoing Bet</h2>
          <p class="sheet-subtitle" id="edit-subtitle">Team Alpha win</p>
        </div>
        <button class="icon-button" type="button" data-close-sheet aria-label="Close Edit Bet sheet">${icons.close}</button>
      </div>
      <div class="sheet-body">
        <form class="form-grid" novalidate>
          <div class="readonly-summary" aria-label="Editable record scope">
            <div class="context-line">
              <div class="context-label">Edit policy</div>
              <div class="context-value">Ongoing/draft only</div>
            </div>
            <div class="context-line">
              <div class="context-label">Match scope</div>
              <div class="context-value">Team Alpha vs Team Beta</div>
            </div>
          </div>
          <div class="field">
            <label for="edit-market-field">Market</label>
            <select class="field-select" id="edit-market-field" name="edit-market-field">
              <option value="1X2">Market 1X2</option>
              <option value="Totals">Totals</option>
              <option value="Manual note">Manual note</option>
            </select>
          </div>
          <div class="field">
            <label for="edit-odds-field">Odds</label>
            <input class="field-input" id="edit-odds-field" name="edit-odds-field" inputmode="decimal" value="2.10">
          </div>
          <div class="field">
            <label for="edit-stake-field">Stake points</label>
            <input class="field-input" id="edit-stake-field" name="edit-stake-field" inputmode="numeric" value="100">
          </div>
          <div class="sheet-actions">
            <button class="secondary-button" type="button" data-close-sheet>Cancel</button>
            <button class="primary-button" type="button" data-close-sheet>Save Edit</button>
          </div>
          <div class="sheet-feedback">Shell only: ongoing edit surface, no data saved.</div>
        </form>
      </div>
    </section>

    <section class="sheet" id="review-sheet" aria-hidden="true" aria-labelledby="review-sheet-title" role="dialog">
      <div class="sheet-grabber" aria-hidden="true"></div>
      <div class="sheet-header">
        <div>
          <h2 class="sheet-title" id="review-sheet-title">Review Draft</h2>
          <p class="sheet-subtitle" id="review-subtitle">Team Alpha vs Team Beta</p>
        </div>
        <button class="icon-button" type="button" data-close-sheet aria-label="Close Review sheet">${icons.close}</button>
      </div>
      <div class="sheet-body">
        <div class="review-list">
          ${renderReviewItem('Record type', 'Manual draft')}
          ${renderReviewItem('Market', 'Market 1X2')}
          ${renderReviewItem('Odds', '2.10')}
          ${renderReviewItem('Stake points', '100 pts')}
        </div>
        <section class="note-card warning">
          <div class="note-eyebrow">Boundary note</div>
          <div class="note-title">This sheet does not calculate returns.</div>
          <p class="note-copy">It only shows how a future review surface could look. No data is stored and no betting advice is generated.</p>
        </section>
        <div class="sheet-actions">
          <button class="secondary-button" type="button" data-close-sheet>Close</button>
          <button class="primary-button" type="button" data-close-sheet>Done</button>
        </div>
      </div>
    </section>
  `;
}

function renderReviewItem(label: string, value: string): string {
  return `
    <div class="review-item">
      <div class="review-label">${escapeHtml(label)}</div>
      <div class="review-value">${escapeHtml(value)}</div>
    </div>
  `;
}

const panelRenderers: Record<
  ProductionNavigationTabId,
  (
    activeTabId: ProductionNavigationTabId,
    translate: TranslateFunction,
    matchFeed: MatchFeedViewState,
    timezone?: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh',
    filters?: {
      groupby: string;
      type: string;
      gender: string;
      selectedLeagues: Set<string>;
    },
    searchQuery?: string,
    isLiveFilterActive?: boolean,
    isFilterPanelOpen?: boolean
  ) => string
> = Object.freeze({
  today: renderTodayPanel,
  matches: (activeTabId, translate, matchFeed, timezone, filters, searchQuery, isLiveFilterActive, isFilterPanelOpen) =>
    renderMatchesPanel(activeTabId, translate, matchFeed, timezone, filters, searchQuery, isLiveFilterActive, isFilterPanelOpen),
  bets: (activeTabId, translate) => renderBetsPanel(activeTabId, translate),
  bankroll: (activeTabId, translate) => renderBankrollPanel(activeTabId, translate),
  miraichi: (activeTabId, translate) => renderMiraichiPanel(activeTabId, translate)
});

export function renderAppShell({
  activeTabId = 'today',
  translate = t,
  matchFeed = defaultMatchFeed,
  timezone = 'local',
  filters = {
    groupby: 'league',
    type: 'all',
    gender: 'all',
    selectedLeagues: new Set<string>()
  },
  searchQuery = '',
  isLiveFilterActive = false,
  isFilterPanelOpen = false
}: {
  readonly activeTabId?: string;
  readonly translate?: TranslateFunction;
  readonly matchFeed?: MatchFeedViewState;
  readonly timezone?: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh';
  readonly filters?: {
    groupby: string;
    type: string;
    gender: string;
    selectedLeagues: Set<string>;
  };
  readonly searchQuery?: string;
  readonly isLiveFilterActive?: boolean;
  readonly isFilterPanelOpen?: boolean;
} = {}): string {
  const safeActiveTabId = getSafeNavigationTabId(activeTabId);
  const activeTab = navigationTabs.find((tab: NavigationTab) => tab.id === safeActiveTabId) ?? navigationTabs[0];
  const panels = navigationTabs.map((tab) =>
    panelRenderers[tab.id](
      safeActiveTabId,
      translate,
      matchFeed,
      timezone,
      filters,
      searchQuery,
      isLiveFilterActive,
      isFilterPanelOpen
    )
  ).join('');

  return `
    <div class="production-page">
      <div class="app-shell" data-production-shell="phase-5-9" data-production-baseline="black-apple-ledger" aria-label="Miraichi Black Apple Ledger production shell">
        <main class="main-scroll" id="main-scroll" data-active-tab="${escapeHtml(safeActiveTabId)}" aria-label="${escapeHtml(activeTab.fallbackDescription)}">
          ${panels}
          ${renderMatchDetailPanel()}
        </main>

        ${renderBottomNavigation({ activeTabId: safeActiveTabId, tabs: navigationTabs, translate })}
        ${renderSheets()}
      </div>
    </div>
  `;
}
