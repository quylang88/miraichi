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
