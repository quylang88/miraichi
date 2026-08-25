import type { ProductionNavigationTabId } from '../../config/navigation-tabs.js';
import type { BankrollViewState } from '../../services/bankroll-service.js';
import type { BetRecordsViewState } from '../../services/bet-record-service.js';
import type { BetReportViewState, DisciplineConfigViewState } from '../../services/core-betting-service.js';
import type { TranslateFunction } from '../../services/i18n-service.js';
import { escapeHtml } from '../html.js';
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
}): string {
  const { activeTabId, translate, bets, bankroll, discipline, report } = input;
  const ongoing = bets.status === 'ready' ? bets.pending : [];
  const reportTimeZone = report.status === 'ready' ? report.report.period.timeZone : 'UTC';
  const todayKey = dateKey(reportTimeZone);
  const net = report.status === 'ready' ? report.report.daily.find((item) => item.date === todayKey)?.profitLossPoints ?? 0 : 0;
  const exposure = bankroll.status === 'ready' ? bankroll.summary.openExposure : 0;
  const config = discipline.status === 'ready' ? discipline.config : null;
  const ruleState = config && [config.dailyStopLossPoints, config.weeklyStopLossPoints, config.bigBetThresholdPoints].some((value) => value !== null)
    ? `${config.timeZone} · v${config.version}` : translate('today.rulesNotConfigured');
  const dailyUtilization = config?.dailyStopLossPoints == null ? null : Math.min(100, Math.max(0, (-net / config.dailyStopLossPoints) * 100));
  const dailyReached = config?.dailyStopLossPoints != null && net <= -config.dailyStopLossPoints;
  const cards = ongoing.map((bet) => `<article class="bet-row"><div class="row-title">${escapeHtml(bet.homeTeamName)} vs ${escapeHtml(bet.awayTeamName)}</div><div class="row-meta">${escapeHtml(bet.selectionLabel)} · ${bet.stakePoints} pts @ ${bet.oddsValue}</div></article>`).join('');

  const metricsHtml = (bankroll.status === 'loading' && report.status === 'loading')
    ? renderSkeletonMetrics(3)
    : `<div class="metric-grid">${metricRow(translate('today.netPnl'), `${net > 0 ? '+' : ''}${net} pts`)}${metricRow(translate('today.openExposure'), `${exposure} pts`)}${metricRow(translate('today.ongoingBets'), String(bets.status === 'loading' ? '…' : ongoing.length))}</div>`;

  const disciplineHtml = discipline.status === 'loading'
    ? `<section class="note-card" aria-hidden="true"><div class="note-eyebrow">${escapeHtml(translate('today.disciplineStatus'))}</div><div class="skeleton-left"><span class="skeleton-text short"></span><span class="skeleton-text heading"></span></div></section>`
    : `<section class="note-card ${!config || dailyReached ? 'warning' : ''}"><div class="note-eyebrow">${escapeHtml(translate('today.disciplineStatus'))}</div><div class="note-title">${escapeHtml(dailyReached ? translate('today.stopLossReached') : ruleState)}</div>${dailyUtilization == null ? '' : `<p class="note-copy">${escapeHtml(translate('today.stopLossUtilization'))}: ${dailyUtilization.toFixed(0)}%</p><div class="discipline-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${dailyUtilization.toFixed(0)}"><span style="width:${dailyUtilization}%"></span></div>`}</section>`;

  const betsListHtml = bets.status === 'loading'
    ? renderSkeletonBetRows(2)
    : (cards || `<p class="empty-state">${escapeHtml(translate('bets.emptyOngoing'))}</p>`);

  return `<section class="${screenClass('today', activeTabId)}" id="screen-today" data-shell-tab-panel="today" aria-labelledby="today-title">
    ${screenHeader(translate('today.eyebrow'), translate('today.title'), 'today-title', `<button class="primary-button add-inline" type="button" data-open-manual-add>${escapeHtml(translate('today.quickAdd'))}</button>`)}
    ${metricsHtml}
    ${disciplineHtml}
    <div class="section-heading"><h2>${escapeHtml(translate('today.ongoingBets'))}</h2></div><div class="stack">${betsListHtml}</div>
  </section>`;
}
