import type {
  LocalMatchDetail,
  LocalMatchEvent,
  LocalMatchLineup,
  LocalMatchSourceRef,
  LocalMatchTeamStats
} from '@miraichi/shared';
import type { MatchDetailViewState } from '../services/match-detail-service.js';
import { formatDateTime, type SupportedLocale, type TranslateFunction } from '../services/i18n-service.js';
import { escapeHtml } from './html.js';
import { renderSportScoreAttribution } from './source-attribution.js';

export type MatchDetailRenderState = MatchDetailViewState | { status: 'loading' };

function renderUnavailable(translate: TranslateFunction, retryable: boolean): string {
  return `<div class="match-detail-unavailable" role="status">
    <p>${escapeHtml(translate('detail.unavailable'))}</p>
    ${retryable ? `<button class="secondary-button" type="button" data-match-detail-retry>${escapeHtml(translate('detail.retry'))}</button>` : ''}
  </div>`;
}

function formatNullable(value: number | null | undefined, translate: TranslateFunction, suffix = ''): string {
  return value === null || value === undefined
    ? escapeHtml(translate('detail.noData'))
    : `${escapeHtml(value)}${suffix}`;
}

function eventOrder(event: LocalMatchEvent): number {
  return event.minute === null ? Number.MAX_SAFE_INTEGER : (event.minute * 100) + (event.extraMinute ?? 0);
}

function eventTypeLabel(event: LocalMatchEvent, translate: TranslateFunction): string {
  const detail = event.detail?.toLowerCase() ?? '';
  if (event.type === 'goal') {
    if (detail.includes('own')) return translate('detail.event.ownGoal');
    if (detail.includes('penalty')) return translate('detail.event.penaltyGoal');
    return translate('detail.event.goal');
  }
  if (event.type === 'penalty') {
    return detail.includes('missed')
      ? translate('detail.event.missedPenalty')
      : translate('detail.event.penaltyGoal');
  }
  if (event.type === 'card') {
    return detail.includes('red')
      ? translate('detail.event.redCard')
      : translate('detail.event.yellowCard');
  }
  if (event.type === 'substitution') return translate('detail.event.substitution');
  return event.label;
}

function eventIcon(event: LocalMatchEvent): string {
  const detail = event.detail?.toLowerCase() ?? '';
  if (event.type === 'goal') return '⚽';
  if (event.type === 'card') return detail.includes('red') ? '🟥' : '🟨';
  if (event.type === 'substitution') return '🔄';
  if (event.type === 'penalty') return detail.includes('missed') ? '❌' : '⚽';
  return '📋';
}

function renderTimeline(detail: LocalMatchDetail, translate: TranslateFunction): string {
  if (detail.events.length === 0) {
    return `<section class="match-detail-section"><h2>${escapeHtml(translate('detail.timeline'))}</h2><div class="match-detail-no-events">${escapeHtml(translate('detail.noEvents'))}</div></section>`;
  }
  const teamNameById = new Map([
    [detail.match.homeTeam.id, detail.match.homeTeam.name],
    [detail.match.awayTeam.id, detail.match.awayTeam.name]
  ]);
  const events = [...detail.events].sort((left, right) => eventOrder(left) - eventOrder(right));
  const rows = events.map((event) => {
    const minute = event.minute === null
      ? translate('detail.noData')
      : `${event.minute}${event.extraMinute ? `+${event.extraMinute}` : ''}'`;
    const teamName = event.teamId ? teamNameById.get(event.teamId) : undefined;
    const actor = event.player || (event.type === 'other' ? event.label : '');
    const assist = event.assist
      ? event.type === 'substitution'
        ? translate('detail.playerIn', { name: event.assist })
        : translate('detail.assist', { name: event.assist })
      : '';
    return `<li class="match-detail-event">
      <span class="match-event-time">${escapeHtml(minute)}</span>
      <span class="match-event-icon" aria-hidden="true">${eventIcon(event)}</span>
      <span class="match-event-content">
        <span class="match-event-type">${escapeHtml(eventTypeLabel(event, translate))}</span>
        ${teamName ? `<span class="match-event-team">${escapeHtml(teamName)}</span>` : ''}
        ${actor ? `<span class="match-event-player">${escapeHtml(actor)}</span>` : ''}
        ${assist ? `<span class="match-event-assist">${escapeHtml(assist)}</span>` : ''}
      </span>
    </li>`;
  }).join('');
  return `<section class="match-detail-section"><h2>${escapeHtml(translate('detail.timeline'))}</h2><ol class="match-detail-timeline">${rows}</ol></section>`;
}

function findTeamStats(detail: LocalMatchDetail, teamId: string): LocalMatchTeamStats | undefined {
  return detail.teamStats?.find((row) => row.teamId === teamId);
}

function renderStatistics(detail: LocalMatchDetail, translate: TranslateFunction): string {
  const home = findTeamStats(detail, detail.match.homeTeam.id);
  const away = findTeamStats(detail, detail.match.awayTeam.id);
  if (!home || !away) {
    return `<section class="match-detail-section"><h2>${escapeHtml(translate('detail.stats'))}</h2><div class="match-detail-no-stats">${escapeHtml(translate('detail.noStats'))}</div></section>`;
  }
  const row = (
    labelKey: string,
    homeValue: number | null | undefined,
    awayValue: number | null | undefined,
    suffix = ''
  ) => (
    `<tr><th scope="row">${escapeHtml(translate(labelKey))}</th><td>${formatNullable(homeValue, translate, suffix)}</td><td>${formatNullable(awayValue, translate, suffix)}</td></tr>`
  );
  return `<section class="match-detail-section match-detail-stats"><h2>${escapeHtml(translate('detail.stats'))}</h2>
    <div class="match-detail-table-scroll"><table>
      <thead><tr><th scope="col"></th><th scope="col">${escapeHtml(detail.match.homeTeam.name)}</th><th scope="col">${escapeHtml(detail.match.awayTeam.name)}</th></tr></thead>
      <tbody>
        ${row('detail.stat.cornerKicks', home.cornerKicks, away.cornerKicks)}
        ${row('detail.stat.yellowCards', home.yellowCards, away.yellowCards)}
        ${row('detail.stat.redCards', home.redCards, away.redCards)}
        ${row('detail.stat.totalShots', home.totalShots, away.totalShots)}
        ${row('detail.stat.shotsOnGoal', home.shotsOnGoal, away.shotsOnGoal)}
        ${row('detail.stat.possession', home.possessionPercentage, away.possessionPercentage, '%')}
        ${row('detail.stat.fouls', home.fouls, away.fouls)}
        ${row('detail.stat.offsides', home.offsides, away.offsides)}
      </tbody>
    </table></div>
  </section>`;
}

function renderLineupPlayers(
  players: LocalMatchLineup['starters'],
  translate: TranslateFunction
): string {
  if (players.length === 0) {
    return `<p class="match-detail-no-lineup">${escapeHtml(translate('detail.noData'))}</p>`;
  }
  return `<ul class="match-detail-lineup-players">${players.map((player) => {
    const number = player.shirtNumber === null || player.shirtNumber === undefined
      ? ''
      : `<span class="match-lineup-number">${escapeHtml(player.shirtNumber)}</span>`;
    const position = player.position
      ? `<span class="match-lineup-position">${escapeHtml(player.position)}</span>`
      : '';
    return `<li>${number}<span>${escapeHtml(player.name)}</span>${position}</li>`;
  }).join('')}</ul>`;
}

function renderLineupTeam(lineup: LocalMatchLineup, translate: TranslateFunction): string {
  return `<section class="match-detail-lineup-team">
    <h3>${escapeHtml(lineup.teamName ?? lineup.teamId)}</h3>
    <p class="match-detail-formation">${escapeHtml(translate('detail.formation'))}: ${lineup.formation ? escapeHtml(lineup.formation) : escapeHtml(translate('detail.noData'))}</p>
    <h4>${escapeHtml(translate('detail.starters'))}</h4>${renderLineupPlayers(lineup.starters, translate)}
    <h4>${escapeHtml(translate('detail.substitutes'))}</h4>${renderLineupPlayers(lineup.substitutes, translate)}
  </section>`;
}

function renderLineups(detail: LocalMatchDetail, translate: TranslateFunction): string {
  if (!detail.lineups || detail.lineups.length === 0) {
    return `<section class="match-detail-section"><h2>${escapeHtml(translate('detail.lineups'))}</h2><div class="match-detail-no-lineup">${escapeHtml(translate('detail.lineupsUnavailable'))}</div></section>`;
  }
  return `<section class="match-detail-section"><h2>${escapeHtml(translate('detail.lineups'))}</h2><div class="match-detail-lineups">${detail.lineups.map((lineup) => renderLineupTeam(lineup, translate)).join('')}</div></section>`;
}

function renderScoreBreakdown(detail: LocalMatchDetail, translate: TranslateFunction): string {
  if (!detail.scoreBreakdown) return '';
  const { halftime, fulltime, extratime, penalty } = detail.scoreBreakdown;
  const row = (labelKey: string, score: { home: number | null; away: number | null }) => (
    `<tr><th scope="row">${escapeHtml(translate(labelKey))}</th><td>${formatNullable(score.home, translate)}</td><td>${formatNullable(score.away, translate)}</td></tr>`
  );
  return `<div class="match-detail-table-scroll"><table class="match-detail-score-breakdown">
    <thead><tr><th scope="col">${escapeHtml(translate('detail.score'))}</th><th scope="col">${escapeHtml(detail.match.homeTeam.name)}</th><th scope="col">${escapeHtml(detail.match.awayTeam.name)}</th></tr></thead>
    <tbody>${row('detail.halftime', halftime)}${row('detail.fulltime', fulltime)}${row('detail.extratime', extratime)}${row('detail.penalty', penalty)}</tbody>
  </table></div>`;
}

function renderReadyDetail(
  detail: LocalMatchDetail,
  translate: TranslateFunction,
  locale: SupportedLocale,
  timeZone: string
): string {
  const match = detail.match;
  const score = match.score.home !== null && match.score.away !== null
    ? `${match.score.home} – ${match.score.away}`
    : (match.status === 'scheduled' ? 'vs' : escapeHtml(translate('detail.noData')));
  const competitionContext = [match.competition.name, match.competition.season, match.round].filter(Boolean).join(' · ');
  const status = translate(`matches.status.${match.status}`, match.status);
  const kickoff = formatDateTime(match.kickoffUtc, locale, timeZone);
  const elapsed = detail.elapsedMinute !== null && detail.elapsedMinute !== undefined
    ? `${detail.elapsedMinute}'`
    : translate('detail.noData');
  const venue = match.venue ? escapeHtml(match.venue) : escapeHtml(translate('detail.noData'));
  const referee = detail.referee ? escapeHtml(detail.referee) : escapeHtml(translate('detail.noData'));

  return `<div class="match-detail-ready" data-match-detail-state="ready">
    <section class="match-detail-summary">
      <p class="match-detail-competition">${escapeHtml(competitionContext)}</p>
      <div class="match-detail-scoreline"><span>${escapeHtml(match.homeTeam.name)}</span><strong>${score}</strong><span>${escapeHtml(match.awayTeam.name)}</span></div>
      <dl class="match-detail-meta">
        <div><dt>${escapeHtml(translate('detail.status'))}</dt><dd><span class="match-status-badge">${escapeHtml(status)}</span></dd></div>
        <div><dt>${escapeHtml(translate('detail.elapsed'))}</dt><dd>${escapeHtml(elapsed)}</dd></div>
        <div><dt>${escapeHtml(translate('detail.kickoff'))}</dt><dd>${escapeHtml(kickoff)}</dd></div>
        <div><dt>${escapeHtml(translate('detail.venue'))}</dt><dd>${venue}</dd></div>
        <div><dt>${escapeHtml(translate('detail.referee'))}</dt><dd>${referee}</dd></div>
      </dl>
    </section>
    ${renderScoreBreakdown(detail, translate)}
    ${detail.warnings?.length ? `<p class="match-detail-coverage-warning">${escapeHtml(translate('detail.partialData'))}</p>` : ''}
    ${renderTimeline(detail, translate)}
    ${renderStatistics(detail, translate)}
    ${renderLineups(detail, translate)}
  </div>`;
}



function sourceRefsForState(state: MatchDetailRenderState): readonly LocalMatchSourceRef[] {
  if (state.status === 'ready') return state.detail.match.sourceRefs;
  if (state.status === 'pending') return state.match.sourceRefs;
  if (state.status === 'unavailable') return state.match?.sourceRefs ?? [];
  return [];
}

export function renderMatchDetailView(
  state: MatchDetailRenderState,
  translate: TranslateFunction,
  locale: SupportedLocale,
  timeZone: string
): string {
  const attribution = renderSportScoreAttribution(sourceRefsForState(state), translate);
  if (state.status === 'loading') {
    return `<div class="match-detail-pending" role="status" data-match-detail-state="loading">${escapeHtml(translate('detail.loading'))}</div>`;
  }
  if (state.status === 'pending') {
    return `<div class="match-detail-pending" role="status" data-match-detail-state="pending">${escapeHtml(translate('detail.pendingRefresh'))}</div>${attribution}`;
  }
  if (state.status === 'unavailable') {
    return `${renderUnavailable(translate, !state.warnings.includes('match_not_found'))}${attribution}`;
  }
  return `${renderReadyDetail(state.detail, translate, locale, timeZone)}${attribution}`;
}
