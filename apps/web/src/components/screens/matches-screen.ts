import type { ProductionNavigationTabId } from '../../config/navigation-tabs.js';
import { formatDateTime, t, type SupportedLocale, type TranslateFunction } from '../../services/i18n-service.js';
import type { AppMatch, MatchFeedViewState } from '../../services/match-feed-service.js';
import { escapeHtml } from '../html.js';
import { renderMonthCalendarPicker, renderSkeletonMatchRows, screenClass, screenHeader } from './screen-shared.js';

const backIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 6-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const nextIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const filterIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const plusIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

export interface MatchFilters {
  readonly groupby: string;
  readonly type: string;
  readonly gender: string;
  readonly selectedLeagues: Set<string>;
}

export interface RibbonDate {
  readonly dateStr: string;
  readonly dayNumber: string;
  readonly label: string;
}

export function getRibbonDates(selectedDateStr: string, translate: TranslateFunction = t): readonly RibbonDate[] {
  const [year, month, day] = selectedDateStr.split('-').map(Number);
  const centerDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [-2, -1, 0, 1, 2].map((offset) => {
    const date = new Date(centerDate);
    date.setDate(centerDate.getDate() + offset);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((compareDate.getTime() - today.getTime()) / 86_400_000);
    const label = diffDays === 0
      ? translate('matches.today')
      : diffDays === -1
        ? translate('matches.yesterday')
        : diffDays === 1
          ? translate('matches.tomorrow')
          : translate(`matches.weekday.${date.getDay()}`);
    return { dateStr, dayNumber: String(date.getDate()), label };
  });
}

function formatKickoffTime(isoValue: string, timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return isoValue || '--:--';
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
  if (timezone !== 'local') options.timeZone = timezone;
  try {
    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch {
    return isoValue || '--:--';
  }
}

function matchTitle(match: AppMatch): string {
  return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
}

function matchMeta(match: AppMatch, translate: TranslateFunction, timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  const suffix = timezone === 'local' ? '' : ` ${timezone}`;
  const event = match.status === 'completed' && match.score.home !== null
    ? translate('matches.score', { score: `${match.score.home}-${match.score.away}` })
    : translate('matches.kickoff', { time: `${formatKickoffTime(match.kickoffUtc, timezone)}${suffix}` });
  return `${match.competition.name}${match.round ? ` · ${match.round}` : ''} · ${event} · ${translate(`matches.status.${match.status}`, match.status)}`;
}

function renderSnapshotStatus(feed: Exclude<MatchFeedViewState, { status: 'loading' }>, translate: TranslateFunction, locale: SupportedLocale, timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  const status = feed.status === 'unavailable'
    ? translate('matches.unavailable')
    : feed.snapshot?.freshness === 'fresh'
      ? translate('matches.ready')
      : feed.snapshot?.freshness === 'stale'
        ? translate('matches.stale')
        : translate('matches.unavailable');
  const generatedAt = !feed.snapshot || feed.snapshot.freshness === 'missing' ? undefined : feed.snapshot.generatedAt;
  const resolvedTimeZone = timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone;
  return `<div class="match-data-status"><span>${escapeHtml(translate('matches.dataStatus', { status }))}</span>${generatedAt ? `<span>${escapeHtml(translate('matches.snapshotGenerated', { date: formatDateTime(generatedAt, locale, resolvedTimeZone) }))}</span>` : ''}</div>`;
}

function renderFeedState(feed: Exclude<MatchFeedViewState, { status: 'ready' }>, translate: TranslateFunction, locale: SupportedLocale, timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  if (feed.status === 'loading') return `<div data-match-feed-state="loading" aria-label="${escapeHtml(translate('matches.loadingStore'))}">${renderSkeletonMatchRows(4)}</div>`;
  if (feed.status === 'unavailable') return `${renderSnapshotStatus(feed, translate, locale, timezone)}<section class="note-card warning" data-match-feed-state="unavailable"><div class="note-eyebrow">${escapeHtml(translate('matches.dataUpdateRequired'))}</div><div class="note-title">${escapeHtml(translate('matches.storeUnavailable'))}</div><p class="note-copy">${escapeHtml(translate('matches.feedUnavailable'))}</p></section>`;
  return `${renderSnapshotStatus(feed, translate, locale, timezone)}<section class="note-card" data-match-feed-state="empty"><div class="note-eyebrow">${escapeHtml(translate('matches.store'))}</div><div class="note-title">${escapeHtml(translate('matches.noMatchesTitle', { date: feed.date }))}</div><p class="note-copy">${escapeHtml(translate('matches.noMatchesCopy'))}</p></section>`;
}

function isWomenMatch(match: AppMatch): boolean {
  return [match.competition.name, match.homeTeam.name, match.awayTeam.name].some((value) => {
    const normalized = value.toLowerCase();
    return normalized.includes('women') || normalized.includes('wmn') || /\s+w\b/i.test(normalized);
  });
}

function renderMatchRow(match: AppMatch, translate: TranslateFunction, timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  const title = matchTitle(match);
  const meta = matchMeta(match, translate, timezone);
  const right = match.status === 'completed' && match.score.home !== null
    ? `<span class="row-score">${match.score.home} – ${match.score.away}</span>`
    : `<span class="row-kickoff">${formatKickoffTime(match.kickoffUtc, timezone)}</span>`;
  return `<article class="match-row clickable" data-match-row data-status="${escapeHtml(match.status)}" data-match-id="${escapeHtml(match.id)}" data-open-match data-match-title="${escapeHtml(title)}" data-match-meta="${escapeHtml(meta)}" role="button" tabindex="0"><div class="row-split"><div class="row-title">${escapeHtml(title)}</div><div class="row-right">${right}</div></div></article>`;
}

function filterMatches(feed: MatchFeedViewState, filters: MatchFilters, searchQuery: string): AppMatch[] {
  if (feed.status !== 'ready') return [];
  const query = searchQuery.trim().toLowerCase();
  return feed.matches.filter((match) => {
    if (query && !match.homeTeam.name.toLowerCase().includes(query) && !match.awayTeam.name.toLowerCase().includes(query)) return false;
    if (filters.type === 'national' && match.competition.type !== 'national-team') return false;
    if (filters.type === 'club' && match.competition.type !== 'club') return false;
    if (filters.gender === 'women' && !isWomenMatch(match)) return false;
    if (filters.gender === 'men' && isWomenMatch(match)) return false;
    return filters.selectedLeagues.size === 0 || filters.selectedLeagues.has(match.competition.name);
  });
}

function renderReadyMatches(matches: readonly AppMatch[], feedDate: string, filters: MatchFilters, translate: TranslateFunction, timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'): string {
  if (matches.length === 0) return '';
  if (filters.groupby === 'time') return `<div class="date-group"><div class="group-label">${escapeHtml(feedDate)}</div>${[...matches].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc)).map((match) => renderMatchRow(match, translate, timezone)).join('')}</div>`;
  const groups = new Map<string, AppMatch[]>();
  for (const match of matches) groups.set(match.competition.name, [...(groups.get(match.competition.name) ?? []), match]);
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([league, leagueMatches]) => `<div class="date-group"><div class="group-label">${escapeHtml(league)}</div>${leagueMatches.sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc)).map((match) => renderMatchRow(match, translate, timezone)).join('')}</div>`).join('');
}

export function renderMatchesScreen(input: {
  readonly activeTabId: ProductionNavigationTabId;
  readonly translate: TranslateFunction;
  readonly locale: SupportedLocale;
  readonly matchFeed: MatchFeedViewState;
  readonly timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh';
  readonly filters: MatchFilters;
  readonly searchQuery: string;
  readonly isFilterPanelOpen: boolean;
  readonly isCalendarOpen?: boolean;
  readonly calendarMonth?: string;
}): string {
  const { activeTabId, translate, locale, matchFeed, timezone, filters, searchQuery, isFilterPanelOpen, isCalendarOpen = false, calendarMonth } = input;
  const filtered = filterMatches(matchFeed, filters, searchQuery);
  const ribbon = getRibbonDates(matchFeed.date, translate).map((date) => `<button class="date-chip${date.dateStr === matchFeed.date ? ' active' : ''}" type="button" data-date="${escapeHtml(date.dateStr)}"><span class="date-chip-label">${escapeHtml(date.label)}</span><span class="date-chip-number">${escapeHtml(date.dayNumber)}</span></button>`).join('');
  const leagues = matchFeed.status === 'ready' ? [...new Set(matchFeed.matches.map((match) => match.competition.name))].sort() : [];
  const leagueOptions = leagues.map((league) => `<label class="filter-option" for="filter-league-${escapeHtml(league)}"><input type="checkbox" id="filter-league-${escapeHtml(league)}" name="filter-league" value="${escapeHtml(league)}" ${filters.selectedLeagues.has(league) ? 'checked' : ''}><span>${escapeHtml(league)}</span></label>`).join('');
  const radio = (group: string, value: string, label: string, checked: boolean) => `<label class="filter-option" for="filter-${group}-${value}"><input type="radio" id="filter-${group}-${value}" name="filter-${group}" value="${value}" ${checked ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
  const content = matchFeed.status === 'ready'
    ? `${renderSnapshotStatus(matchFeed, translate, locale, timezone)}${renderReadyMatches(filtered, matchFeed.date, filters, translate, timezone)}`
    : renderFeedState(matchFeed, translate, locale, timezone);
  const todayStr = new Date().toISOString().slice(0, 10);
  const calendarPicker = isCalendarOpen
    ? renderMonthCalendarPicker({
        id: 'matches-calendar-picker',
        extraClass: 'matches-calendar-picker',
        month: calendarMonth || matchFeed.date.slice(0, 7) || todayStr.slice(0, 7),
        selectedDate: matchFeed.date,
        translate,
        locale,
        todayStr,
        navAttr: 'data-matches-cal-nav',
        dateAttr: 'data-matches-cal-date'
      })
    : '';
  return `<section class="${screenClass('matches', activeTabId)}" id="screen-matches" data-shell-tab-panel="matches" aria-labelledby="matches-title">
    ${screenHeader(translate('matches.eyebrow'), translate('matches.title'), 'matches-title', `<button class="primary-button add-inline" type="button" data-open-manual-add>${escapeHtml(translate('matches.manualAdd'))}</button>`)}
    <div class="date-navigator"><button id="date-prev-btn" class="nav-arrow-btn" type="button" aria-label="${escapeHtml(translate('matches.previousDay'))}">${backIcon}</button><div class="date-ribbon">${ribbon}</div><button id="date-next-btn" class="nav-arrow-btn" type="button" aria-label="${escapeHtml(translate('matches.nextDay'))}">${nextIcon}</button><button id="date-picker-btn" class="calendar-btn${isCalendarOpen ? ' active' : ''}" type="button" aria-label="${escapeHtml(translate('matches.pickDate'))}"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></button></div>
    ${calendarPicker}
    <div class="search-row"><input class="search-input" id="match-search" type="search" placeholder="${escapeHtml(translate('matches.search'))}" aria-label="${escapeHtml(translate('matches.search'))}"><button class="filter-button" id="filter-panel-toggle-btn" type="button" aria-label="${escapeHtml(translate('matches.openFilters'))}">${filterIcon}</button></div>
    <div class="filter-panel" id="matches-filter-panel" ${isFilterPanelOpen ? '' : 'hidden'}><div class="filter-group"><span class="filter-group-title">${escapeHtml(translate('matches.sortGroup'))}</span><div class="filter-options">${radio('groupby', 'league', translate('matches.league'), filters.groupby === 'league')}${radio('groupby', 'time', translate('matches.time'), filters.groupby === 'time')}</div></div><div class="filter-group"><span class="filter-group-title">${escapeHtml(translate('matches.competitionType'))}</span><div class="filter-options">${radio('type', 'all', translate('matches.all'), filters.type === 'all')}${radio('type', 'national', translate('matches.national'), filters.type === 'national')}${radio('type', 'club', translate('matches.club'), filters.type === 'club')}</div></div><div class="filter-group"><span class="filter-group-title">${escapeHtml(translate('matches.gender'))}</span><div class="filter-options">${radio('gender', 'all', translate('matches.all'), filters.gender === 'all')}${radio('gender', 'men', translate('matches.men'), filters.gender === 'men')}${radio('gender', 'women', translate('matches.women'), filters.gender === 'women')}</div></div><div class="filter-group full-width"><span class="filter-group-title">${escapeHtml(translate('matches.leagues'))}</span><div id="filter-leagues-list" class="leagues-checklist">${leagueOptions}</div></div></div>
    ${content}<div class="empty-state" id="matches-empty" style="display: ${matchFeed.status === 'ready' && filtered.length === 0 ? 'block' : 'none'};">${escapeHtml(translate('matches.noFilterResults'))}</div>
  </section>`;
}

export function renderMatchDetailScreen(translate: TranslateFunction): string {
  return `<section class="screen" id="screen-match-detail" aria-labelledby="match-detail-title"><button class="secondary-button back-button" type="button" id="match-detail-back">${backIcon}${escapeHtml(translate('detail.back'))}</button><div class="screen-header"><div><p class="screen-label">${escapeHtml(translate('detail.title'))}</p><h1 class="screen-title" id="match-detail-title">${escapeHtml(translate('matches.selected'))}</h1><p class="screen-subtitle" id="match-detail-meta">${escapeHtml(translate('matches.chooseDetail'))}</p></div></div><div class="match-context" aria-label="${escapeHtml(translate('matches.groupContext'))}"><div class="context-line"><div class="context-label">${escapeHtml(translate('matches.groupingKey'))}</div><div class="context-value">matchGroupId</div></div><div class="context-line"><div class="context-label">${escapeHtml(translate('matches.entryRule'))}</div><div class="context-value">${escapeHtml(translate('matches.addThrough'))}</div></div></div><div class="segmented two" role="tablist" aria-label="${escapeHtml(translate('matches.detailTabs'))}"><button class="active" type="button" data-detail-tab="bets">${escapeHtml(translate('bets.title'))}</button><button type="button" data-detail-tab="info">${escapeHtml(translate('matches.info'))}</button></div><div class="detail-panel" id="match-detail-panel-bets"><div class="action-row"><button class="primary-button add-inline" type="button" data-open-scoped-add data-add-bet-boundary="planned">${plusIcon}${escapeHtml(translate('bets.add'))}</button></div><div class="stack"><p class="empty-state">${escapeHtml(translate('matches.openBetsHint'))}</p></div></div><div class="detail-panel" id="match-detail-panel-info" hidden><section class="note-card"><div class="note-eyebrow">${escapeHtml(translate('matches.detailBoundary'))}</div><div class="note-title">${escapeHtml(translate('matches.detailContext'))}</div><p class="note-copy">${escapeHtml(translate('matches.detailBoundaryCopy'))}</p></section></div></section>`;
}
