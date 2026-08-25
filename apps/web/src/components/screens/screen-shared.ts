import type { ProductionNavigationTabId } from '../../config/navigation-tabs.js';
import type { SupportedLocale, TranslateFunction } from '../../services/i18n-service.js';
import { escapeHtml } from '../html.js';

export function screenClass(tabId: ProductionNavigationTabId, activeTabId: ProductionNavigationTabId): string {
  return tabId === activeTabId ? 'screen active' : 'screen';
}

export function screenHeader(label: string, title: string, titleId: string, aside = ''): string {
  return `<div class="screen-header"><div><p class="screen-label">${escapeHtml(label)}</p><h1 class="screen-title" id="${escapeHtml(titleId)}">${escapeHtml(title)}</h1></div>${aside}</div>`;
}

export function metricRow(label: string, value: string, state = ''): string {
  return `<div class="points-row"><div><div class="points-label">${escapeHtml(label)}</div><div class="points-value">${escapeHtml(value)}</div></div>${state ? `<div class="points-state">${escapeHtml(state)}</div>` : ''}</div>`;
}

export function renderSkeletonMetrics(count = 3): string {
  const item = '<div class="points-row"><div class="skeleton-left"><span class="skeleton-text short"></span><span class="skeleton-text heading"></span></div></div>';
  return `<div class="metric-grid" aria-hidden="true">${item.repeat(count)}</div>`;
}

export function renderSkeletonBetRows(count = 3): string {
  const item = '<article class="bet-row bet-card"><div class="row-split"><div class="skeleton-left"><span class="skeleton-text medium"></span><span class="skeleton-text short"></span></div><span class="skeleton-pill"></span></div><div class="bet-facts"><span class="skeleton-text short"></span><span class="skeleton-text short"></span></div></article>';
  return `<div class="stack" aria-hidden="true">${item.repeat(count)}</div>`;
}

export function renderSkeletonMatchRows(count = 4): string {
  const row = '<article class="match-row"><div class="row-split"><div class="skeleton-left"><span class="skeleton-text medium"></span></div><span class="skeleton-pill"></span></div></article>';
  return `<div class="date-group" aria-hidden="true"><div class="group-label"><span class="skeleton-text short"></span></div>${row.repeat(count)}</div>`;
}

export function renderSkeletonLedgerRows(count = 4): string {
  const item = '<div class="ledger-row"><div class="skeleton-left"><span class="skeleton-text short"></span><span class="skeleton-text medium"></span></div><span class="skeleton-pill"></span></div>';
  return `<div class="stack" aria-hidden="true">${item.repeat(count)}</div>`;
}

export function renderSkeletonCard(): string {
  return '<section class="note-card" aria-hidden="true"><div class="skeleton-left"><span class="skeleton-text short"></span><span class="skeleton-text heading"></span><span class="skeleton-text medium"></span></div></section>';
}

export function renderMonthCalendarPicker(options: {
  readonly month: string;
  readonly selectedDate?: string | null | undefined;
  readonly rangeStart?: string | null | undefined;
  readonly rangeEnd?: string | null | undefined;
  readonly translate: TranslateFunction;
  readonly locale: SupportedLocale;
  readonly todayStr?: string | undefined;
  readonly id?: string | undefined;
  readonly extraClass?: string | undefined;
  readonly navAttr?: string | undefined;
  readonly dateAttr?: string | undefined;
  readonly actionsHtml?: string | undefined;
}): string {
  const today = options.todayStr ?? new Date().toISOString().slice(0, 10);
  const [yearNum, monthNum] = (options.month || today.slice(0, 7)).split('-').map(Number);
  const dateObj = new Date(yearNum, monthNum - 1, 1);
  const rawMonthTitle = new Intl.DateTimeFormat(options.locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'long', year: 'numeric' }).format(dateObj);
  const monthTitle = rawMonthTitle.charAt(0).toUpperCase() + rawMonthTitle.slice(1);

  const firstDay = new Date(yearNum, monthNum - 1, 1).getDay();
  const leadDays = (firstDay + 6) % 7;
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

  const navAttr = options.navAttr ?? 'data-cal-nav';
  const dateAttr = options.dateAttr ?? 'data-cal-date';
  const start = options.rangeStart ?? options.selectedDate ?? null;
  const end = options.rangeEnd ?? null;

  let cells = '';
  for (let i = 0; i < leadDays; i++) {
    cells += '<span class="cal-day empty" aria-hidden="true"></span>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const classes: string[] = ['cal-day'];
    if (dateStr === today) classes.push('today');
    if (start && dateStr === start) classes.push('selected-start');
    if (end && dateStr === end) classes.push('selected-end');
    if (start && end && dateStr > start && dateStr < end) classes.push('in-range');

    cells += `<button type="button" class="${classes.join(' ')}" ${dateAttr}="${dateStr}">${d}</button>`;
  }

  const idAttr = options.id ? ` id="${escapeHtml(options.id)}"` : '';
  const classNames = ['calendar-picker', options.extraClass].filter(Boolean).join(' ');
  const actions = options.actionsHtml ? `<div class="cal-actions">${options.actionsHtml}</div>` : '';

  return `<div class="${classNames}"${idAttr}><div class="cal-header"><button type="button" class="cal-nav-btn" ${navAttr}="prev" aria-label="${escapeHtml(options.translate('bankroll.prevMonth'))}">‹</button><span class="cal-month-title">${escapeHtml(monthTitle)}</span><button type="button" class="cal-nav-btn" ${navAttr}="next" aria-label="${escapeHtml(options.translate('bankroll.nextMonth'))}">›</button></div><div class="cal-weekdays"><span>${escapeHtml(options.translate('matches.weekday.1'))}</span><span>${escapeHtml(options.translate('matches.weekday.2'))}</span><span>${escapeHtml(options.translate('matches.weekday.3'))}</span><span>${escapeHtml(options.translate('matches.weekday.4'))}</span><span>${escapeHtml(options.translate('matches.weekday.5'))}</span><span>${escapeHtml(options.translate('matches.weekday.6'))}</span><span>${escapeHtml(options.translate('matches.weekday.0'))}</span></div><div class="cal-grid">${cells}</div>${actions}</div>`;
}

