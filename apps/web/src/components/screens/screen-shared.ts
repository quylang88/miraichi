import type { ProductionNavigationTabId } from '../../config/navigation-tabs.js';
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

