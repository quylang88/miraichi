import type { ProductionNavigationTabId } from '../../config/navigation-tabs.js';
import type { BankrollViewState } from '../../services/bankroll-service.js';
import type { BetRecordsViewState } from '../../services/bet-record-service.js';
import type { BetReportViewState, DisciplineConfigViewState } from '../../services/core-betting-service.js';
import { formatDateTime, type SupportedLocale, type TranslateFunction } from '../../services/i18n-service.js';
import type { MatchFeedViewState } from '../../services/match-feed-service.js';
import { escapeHtml } from '../html.js';
import {
  renderSportScoreAttribution,
  sourceEvidenceFromMatchFeed
} from '../source-attribution.js';
import { metricRow, renderSkeletonBetRows, renderSkeletonMetrics, screenClass, screenHeader } from './screen-shared.js';

function dateKey(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function renderTodayScreen(input: {
  readonly activeTabId: ProductionNavigationTabId;
  readonly translate: TranslateFunction;
  readonly bets: BetRecordsViewState;
  readonly bankroll: BankrollViewState;
  readonly discipline: DisciplineConfigViewState;
  readonly report: BetReportViewState;
  readonly matchFeed?: MatchFeedViewState;
  readonly locale?: SupportedLocale;
  readonly timezone?: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh';
}): string {
  const {
    activeTabId,
    translate,
    bets,
    bankroll,
    discipline,
    report,
    matchFeed,
    locale = 'en',
    timezone = 'local'
  } = input;
  const ongoing = bets.status === 'ready' ? bets.pending : [];
  const reportTimeZone = report.status === 'ready' ? report.report.period.timeZone : 'UTC';
  const todayKey = dateKey(reportTimeZone);
  const net = report.status === 'ready' ? report.report.daily.find((item) => item.date === todayKey)?.profitLossPoints ?? 0 : null;
  const exposure = bankroll.status === 'ready' ? bankroll.summary.openExposure : 0;
  const config = discipline.status === 'ready' ? discipline.config : null;
  const ruleState = config && [config.dailyStopLossPoints, config.weeklyStopLossPoints, config.bigBetThresholdPoints].some((value) => value !== null)
    ? `${config.timeZone} · v${config.version}` : translate('today.rulesNotConfigured');
  const dailyUtilization = config?.dailyStopLossPoints == null || net === null ? null : Math.min(100, Math.max(0, (-net / config.dailyStopLossPoints) * 100));
  const dailyReached = config?.dailyStopLossPoints != null && net !== null && net <= -config.dailyStopLossPoints;
  const cards = ongoing.map((bet) => `<article class="bet-row"><div class="row-title">${escapeHtml(bet.homeTeamName)} vs ${escapeHtml(bet.awayTeamName)}</div><div class="row-meta">${escapeHtml(bet.selectionLabel)} · ${bet.stakePoints} pts @ ${bet.oddsValue}</div></article>`).join('');

  const netValue = report.status === 'ready' && net !== null ? `${net > 0 ? '+' : ''}${net} pts` : report.status === 'loading' ? '…' : translate('common.unavailable');
  const exposureValue = bankroll.status === 'ready' ? `${exposure} pts` : bankroll.status === 'loading' ? '…' : translate('common.unavailable');
  const ongoingValue = bets.status === 'ready' ? String(ongoing.length) : bets.status === 'loading' ? '…' : translate('common.unavailable');
  const metricsHtml = (bankroll.status === 'loading' && report.status === 'loading')
    ? renderSkeletonMetrics(3)
    : `<div class="metric-grid">${metricRow(translate('today.netPnl'), netValue)}${metricRow(translate('today.openExposure'), exposureValue)}${metricRow(translate('today.ongoingBets'), ongoingValue)}</div>`;

  const disciplineHtml = discipline.status === 'loading'
    ? `<section class="note-card" aria-hidden="true"><div class="note-eyebrow">${escapeHtml(translate('today.disciplineStatus'))}</div><div class="skeleton-left"><span class="skeleton-text short"></span><span class="skeleton-text heading"></span></div></section>`
    : `<section class="note-card ${!config || dailyReached ? 'warning' : ''}"><div class="note-eyebrow">${escapeHtml(translate('today.disciplineStatus'))}</div><div class="note-title">${escapeHtml(dailyReached ? translate('today.stopLossReached') : ruleState)}</div>${dailyUtilization == null ? '' : `<p class="note-copy">${escapeHtml(translate('today.stopLossUtilization'))}: ${dailyUtilization.toFixed(0)}%</p><div class="discipline-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${dailyUtilization.toFixed(0)}"><span style="width:${dailyUtilization}%"></span></div>`}</section>`;

  const betsListHtml = bets.status === 'loading'
    ? renderSkeletonBetRows(2)
    : (cards || `<p class="empty-state">${escapeHtml(translate('bets.emptyOngoing'))}</p>`);
  const matchSourceHtml = renderTodayMatchSource(matchFeed, translate, locale, timezone);

  return `<section class="${screenClass('today', activeTabId)}" id="screen-today" data-shell-tab-panel="today" aria-labelledby="today-title">
    ${screenHeader(translate('today.eyebrow'), translate('today.title'), 'today-title', `<button class="primary-button add-inline" type="button" data-open-manual-add>${escapeHtml(translate('today.quickAdd'))}</button>`)}
    ${metricsHtml}
    ${matchSourceHtml}
    ${disciplineHtml}
    <div class="section-heading"><h2>${escapeHtml(translate('today.ongoingBets'))}</h2></div><div class="stack">${betsListHtml}</div>
  </section>`;
}

function renderTodayMatchSource(
  feed: MatchFeedViewState | undefined,
  translate: TranslateFunction,
  locale: SupportedLocale,
  timezone: 'local' | 'UTC' | 'Asia/Ho_Chi_Minh'
): string {
  if (!feed || feed.status === 'loading') return '';
  const sources = sourceEvidenceFromMatchFeed(feed);
  const attribution = renderSportScoreAttribution(sources, translate);
  const freshness = feed.status === 'unavailable'
    ? 'unavailable'
    : feed.snapshot.freshness;
  const generatedAt = feed.snapshot?.freshness === 'missing'
    ? undefined
    : feed.snapshot?.generatedAt;
  const resolvedTimeZone = timezone === 'local'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : timezone;
  return `<section class="note-card${freshness === 'fresh' ? '' : ' warning'}" data-today-match-source-status="${freshness}">
    <div class="note-eyebrow">${escapeHtml(translate('source.matchData'))}</div>
    <div class="note-title">${escapeHtml(translate(`source.${freshness}`))}</div>
    ${generatedAt ? `<p class="note-copy">${escapeHtml(translate('source.updatedAt', { date: formatDateTime(generatedAt, locale, resolvedTimeZone) }))}</p>` : ''}
    ${attribution}
  </section>`;
}
