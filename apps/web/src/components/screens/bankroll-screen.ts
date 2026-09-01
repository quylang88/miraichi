import type { ProductionNavigationTabId } from '../../config/navigation-tabs.js';
import type { BankrollViewState } from '../../services/bankroll-service.js';
import type { BetReportPeriod, BetReportViewState, DisciplineConfigViewState } from '../../services/core-betting-service.js';
import { formatDateTime, type SupportedLocale, type TranslateFunction } from '../../services/i18n-service.js';
import { escapeHtml } from '../html.js';
import { metricRow, renderMonthCalendarPicker, renderSkeletonCard, renderSkeletonLedgerRows, renderSkeletonMetrics, screenClass, screenHeader } from './screen-shared.js';

export type BankrollSecondaryView = 'overview' | 'analytics' | 'discipline' | 'ledger';

function overview(state: Extract<BankrollViewState, { status: 'ready' }>, translate: TranslateFunction): string {
  return `<div class="metric-grid">${metricRow(translate('bankroll.realizedBalance'), `${state.summary.realizedBalance} pts`)}${metricRow(translate('bankroll.openExposure'), `${state.summary.openExposure} pts`)}${metricRow(translate('bankroll.availableBalance'), `${state.summary.availableBalance} pts`)}</div>`;
}

function ledger(state: Extract<BankrollViewState, { status: 'ready' }>, translate: TranslateFunction, locale: SupportedLocale, timeZone: string): string {
  const entries = state.ledger.map((entry) => `<div class="ledger-row"><div><div class="ledger-title">${escapeHtml(translate(`ledger.${entry.entryType}`, entry.entryType))}</div><div class="ledger-meta">${escapeHtml(formatDateTime(entry.occurredAt, locale, timeZone))}${entry.note ? ` · ${escapeHtml(entry.note)}` : ''}</div></div><span class="ledger-state">${entry.amountPoints > 0 ? '+' : ''}${entry.amountPoints} pts</span></div>`).join('');
  return `<div class="action-row" aria-label="${escapeHtml(translate('bankroll.ledger'))}"><button type="button" class="secondary-button" data-ledger-type="deposit">${escapeHtml(translate('bankroll.deposit'))}</button><button type="button" class="secondary-button" data-ledger-type="withdrawal">${escapeHtml(translate('bankroll.withdrawal'))}</button><button type="button" class="secondary-button" data-ledger-type="correction">${escapeHtml(translate('bankroll.correction'))}</button></div><div class="stack">${entries || `<p class="empty-state">${escapeHtml(translate('bankroll.noLedger'))}</p>`}</div>`;
}

function discipline(state: DisciplineConfigViewState, translate: TranslateFunction): string {
  if (state.status === 'loading') return renderSkeletonCard();
  if (state.status === 'unavailable') return `<section class="note-card warning"><div class="note-title">${escapeHtml(translate(`error.${state.code}`, translate('error.request_failed')))}</div></section>`;
  const config = state.config;
  const notConfigured = !config || [config.dailyStopLossPoints, config.weeklyStopLossPoints, config.bigBetThresholdPoints].every((value) => value === null);
  const value = (input: number | null | undefined) => input == null ? '' : String(input);
  return `${notConfigured ? `<section class="note-card warning"><div class="note-title">${escapeHtml(translate('bankroll.rulesNotConfigured'))}</div></section>` : ''}<form class="form-grid discipline-form" id="discipline-form">
    <div class="field"><label for="daily-stop-loss">${escapeHtml(translate('bankroll.dailyStopLoss'))}</label><input class="field-input" id="daily-stop-loss" name="dailyStopLossPoints" type="number" min="0" step="0.01" value="${value(config?.dailyStopLossPoints)}"></div>
    <div class="field"><label for="weekly-stop-loss">${escapeHtml(translate('bankroll.weeklyStopLoss'))}</label><input class="field-input" id="weekly-stop-loss" name="weeklyStopLossPoints" type="number" min="0" step="0.01" value="${value(config?.weeklyStopLossPoints)}"></div>
    <div class="field"><label for="big-bet-threshold">${escapeHtml(translate('bankroll.bigBetThreshold'))}</label><input class="field-input" id="big-bet-threshold" name="bigBetThresholdPoints" type="number" min="0" step="0.01" value="${value(config?.bigBetThresholdPoints)}"></div>
    <div class="field">
      <label for="discipline-week-start-day">${escapeHtml(translate('bankroll.weekStartDay'))}</label>
      <select class="field-select" id="discipline-week-start-day" name="weekStartDay">
        <option value="monday"${config?.weekStartDay !== 'sunday' ? ' selected' : ''}>${escapeHtml(translate('bankroll.monday'))}</option>
        <option value="sunday"${config?.weekStartDay === 'sunday' ? ' selected' : ''}>${escapeHtml(translate('bankroll.sunday'))}</option>
      </select>
      <p class="field-hint">${escapeHtml(translate('bankroll.weekStartDayHint'))}</p>
    </div>
    <button class="primary-button" type="submit">${escapeHtml(translate('common.save'))}</button><div class="sheet-feedback" id="discipline-feedback" aria-live="polite"></div>
  </form>`;
}

function analytics(
  state: BetReportViewState,
  selectedPeriod: BetReportPeriod,
  translate: TranslateFunction,
  customCalendarMonth?: string,
  customRangeStart?: string | null,
  customRangeEnd?: string | null,
  locale: SupportedLocale = 'en'
): string {
  const periodButton = (period: BetReportPeriod, key: string) => {
    const isActive = selectedPeriod === period || (period === 'this_week' && selectedPeriod === 'week') || (period === 'this_month' && selectedPeriod === 'month');
    return `<button class="${isActive ? 'active' : ''}" type="button" data-report-period="${period}">${escapeHtml(translate(key))}</button>`;
  };
  const controls = `<div class="segmented report-periods" role="tablist">${periodButton('this_week', 'bankroll.thisWeek')}${periodButton('previous_week', 'bankroll.previousWeek')}${periodButton('this_month', 'bankroll.thisMonth')}${periodButton('all', 'bankroll.allTime')}${periodButton('custom', 'bankroll.customRange')}</div>`;

  const todayStr = new Date().toISOString().slice(0, 10);
  let statusHint = translate('bankroll.selectStartDate');
  if (customRangeStart && !customRangeEnd) {
    statusHint = `${translate('bankroll.from')} ${customRangeStart} (${translate('bankroll.selectEndDate')})`;
  } else if (customRangeStart && customRangeEnd) {
    const startMs = new Date(customRangeStart).getTime();
    const endMs = new Date(customRangeEnd).getTime();
    const diffDays = Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
    statusHint = `${translate('bankroll.from')} ${customRangeStart} ${translate('bankroll.to')} ${customRangeEnd} (${diffDays} ${translate('bankroll.days')})`;
  }
  const actionsHtml = `<span class="cal-status-hint">${escapeHtml(statusHint)}</span><button type="button" class="primary-button" data-action="apply-custom-range"${!customRangeStart ? ' disabled' : ''}>${escapeHtml(translate('bankroll.applyFilter'))}</button>`;

  const calendarPicker = selectedPeriod === 'custom'
    ? renderMonthCalendarPicker({
        month: customCalendarMonth || todayStr.slice(0, 7),
        rangeStart: customRangeStart ?? null,
        rangeEnd: customRangeEnd ?? null,
        translate,
        locale,
        todayStr,
        actionsHtml
      })
    : '';

  if (state.status === 'loading') return `${controls}${calendarPicker}${renderSkeletonMetrics(4)}<div class="stack">${renderSkeletonCard()}</div>`;
  if (state.status === 'unavailable') return `${controls}${calendarPicker}<section class="note-card warning"><div class="note-title">${escapeHtml(translate(`error.${state.code}`, translate('error.request_failed')))}</div></section>`;
  if (state.status === 'empty') return `${controls}${calendarPicker}<p class="empty-state">${escapeHtml(translate('bets.emptySettled'))}</p>`;
  const report = state.report;
  const rangeBadge = (report.period.startDate && report.period.endDate)
    ? `<div class="report-range-badge">📅 ${escapeHtml(report.period.startDate)} – ${escapeHtml(report.period.endDate)}</div>`
    : '';
  const bars = report.daily.map((bucket) => `<div class="report-bar ${bucket.profitLossPoints < 0 ? 'negative' : 'positive'}" title="${escapeHtml(bucket.date)}: ${bucket.profitLossPoints} pts"><span style="height:${Math.max(4, Math.min(100, Math.abs(bucket.profitLossPoints)))}%"></span><small>${escapeHtml(bucket.date.slice(5))}</small></div>`).join('');
  const breakdown = (title: string, prefix: string | null, entries: Readonly<Record<string, { readonly count: number; readonly profitLossPoints: number }>>, explicitSample = false) => `<section class="note-card"><div class="note-eyebrow">${escapeHtml(title)}</div>${Object.entries(entries).map(([key, item]) => `<div class="ledger-row"><span>${escapeHtml(prefix ? translate(`${prefix}.${key}`, key) : key)}</span><span>${explicitSample ? 'n=' : ''}${item.count} · ${item.profitLossPoints} pts</span></div>`).join('') || `<p class="empty-state">—</p>`}</section>`;
  const outcomes = `<section class="note-card"><div class="note-eyebrow">${escapeHtml(translate('reports.outcomes'))}</div>${Object.entries(report.outcomes).map(([key, count]) => `<div class="ledger-row"><span>${escapeHtml(translate(`settlement.${key}`, key))}</span><span>${count}</span></div>`).join('') || `<p class="empty-state">—</p>`}</section>`;
  return `${controls}${calendarPicker}${rangeBadge}<div class="metric-grid">${metricRow(translate('reports.netPnl'), `${report.netProfitLossPoints} pts`)}${metricRow(translate('reports.averageStake'), `${report.averageStakePoints} pts`)}${metricRow(translate('reports.winRate'), `${report.winRatePercent}%`)}${metricRow(translate('reports.overrides'), String(report.disciplineOverrideCount))}</div><div class="report-bars" aria-label="${escapeHtml(translate('reports.netPnl'))}">${bars}</div><p class="field-hint">${escapeHtml(translate('reports.psychologyDescription'))}</p><div class="analytics-grid">${outcomes}${breakdown(translate('reports.markets'), null, report.market)}${breakdown(translate('reports.emotions'), 'emotion', report.psychology.emotion, true)}${breakdown(translate('reports.motivations'), 'motivation', report.psychology.motivation, true)}${breakdown(translate('reports.planAdherence'), 'adherence', report.psychology.planAdherence, true)}</div>`;
}

export function renderBankrollScreen(input: {
  readonly activeTabId: ProductionNavigationTabId;
  readonly translate: TranslateFunction;
  readonly locale: SupportedLocale;
  readonly timeZone: string;
  readonly state: BankrollViewState;
  readonly view: BankrollSecondaryView;
  readonly disciplineConfigState: DisciplineConfigViewState;
  readonly reportState: BetReportViewState;
  readonly reportPeriod: BetReportPeriod;
  readonly customCalendarMonth?: string | undefined;
  readonly customRangeStart?: string | null | undefined;
  readonly customRangeEnd?: string | null | undefined;
}): string {
  const {
    activeTabId, translate, locale, timeZone, state, view,
    disciplineConfigState, reportState, reportPeriod,
    customCalendarMonth, customRangeStart, customRangeEnd
  } = input;
  const tab = (value: BankrollSecondaryView, key: string) => `<button class="${view === value ? 'active' : ''}" type="button" data-bankroll-view="${value}">${escapeHtml(translate(key))}</button>`;
  let body = `<div data-bankroll-state="loading" aria-label="${escapeHtml(translate('common.loading'))}">${view === 'ledger' ? renderSkeletonLedgerRows(4) : view === 'discipline' ? renderSkeletonCard() : renderSkeletonMetrics(3)}</div>`;
  if (state.status === 'unavailable') body = `<section class="note-card warning" data-bankroll-state="unavailable"><div class="note-title">${escapeHtml(translate('common.unavailable'))}</div><p class="note-copy">${escapeHtml(translate('error.request_failed'))}</p></section>`;
  if (state.status === 'compatibility') body = `<section class="note-card warning" data-bankroll-state="compatibility"><div class="note-title">${escapeHtml(translate('bankroll.compatibilityRequired'))}</div><p class="note-copy">${escapeHtml(translate('bankroll.compatibilityCopy', { count: state.accounts.length }))}</p></section>`;
  if (state.status === 'empty') body = view === 'discipline'
    ? discipline(disciplineConfigState, translate)
    : view === 'analytics'
      ? analytics(reportState, reportPeriod, translate, customCalendarMonth, customRangeStart, customRangeEnd, locale)
      : `<section class="note-card warning" data-bankroll-state="empty"><div class="note-title">${escapeHtml(translate('bankroll.setupRequired'))}</div></section><section class="note-card"><form class="form-grid" id="setup-bankroll-form"><div class="field"><label for="bankroll-opening">${escapeHtml(translate('bankroll.openingPoints'))}</label><input class="field-input" id="bankroll-opening" name="opening" type="number" min="0.01" step="0.01" required></div><button class="primary-button" type="submit">${escapeHtml(translate('bankroll.setupAction'))}</button><div class="sheet-feedback" id="bankroll-setup-feedback" aria-live="polite"></div></form></section>`;
  if (state.status === 'ready') {
    const selected = state.accounts[0]!;
    const content = view === 'overview'
      ? overview(state, translate)
      : view === 'analytics'
        ? analytics(reportState, reportPeriod, translate, customCalendarMonth, customRangeStart, customRangeEnd, locale)
        : view === 'discipline'
          ? discipline(disciplineConfigState, translate)
          : ledger(state, translate, locale, timeZone);
    body = `<div data-bankroll-state="ready"><div class="bankroll-toolbar"><span class="points-state">${selected.currentBalancePoints} pts</span></div>${content}</div>`;
  }
  return `<section class="${screenClass('bankroll', activeTabId)}" id="screen-bankroll" data-shell-tab-panel="bankroll" aria-labelledby="bankroll-title">${screenHeader(translate('bankroll.eyebrow'), translate('bankroll.title'), 'bankroll-title', `<button class="secondary-button" type="button" data-open-settings>${escapeHtml(translate('bankroll.settings'))}</button>`)}<div class="segmented bankroll-views" role="tablist">${tab('overview', 'bankroll.overview')}${tab('analytics', 'bankroll.analytics')}${tab('discipline', 'bankroll.discipline')}${tab('ledger', 'bankroll.ledger')}</div><div class="points-grid">${body}</div></section>`;
}
