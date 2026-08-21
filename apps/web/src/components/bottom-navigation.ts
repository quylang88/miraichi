import { navigationTabs, type NavigationTab, type ProductionNavigationTabId } from '../config/navigation-tabs.js';
import { t, type TranslateFunction } from '../services/i18n-service.js';
import { escapeHtml } from './html.js';

const tabIcons: Record<ProductionNavigationTabId, string> = Object.freeze({
  today: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  matches: '<svg viewBox="0 0 24 24" fill="none" data-icon="stadium"><path d="M4 11c1.8-3 4.6-4.5 8-4.5s6.2 1.5 8 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5 11v6h14v-6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 11v6M12 9v8M16 11v6M7 20h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  bets: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l4 4v14H7V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h4M9.5 13h5M9.5 16h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  bankroll: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 19V9M10 19V5M15 19v-7M20 19H4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
});

export function renderBottomNavigation({
  activeTabId = 'today',
  tabs = navigationTabs,
  translate = t
}: {
  readonly activeTabId?: ProductionNavigationTabId;
  readonly tabs?: readonly NavigationTab[];
  readonly translate?: TranslateFunction;
} = {}): string {
  const items = tabs.map((tab) => {
    const isActive = tab.id === activeTabId;
    const label = translate(tab.labelKey, tab.fallbackLabel);

    return `
      <button
        class="nav-item${isActive ? ' active' : ''}"
        type="button"
        data-primary-tab="${escapeHtml(tab.id)}"
        data-screen="${escapeHtml(tab.id)}"
        data-tab-target="${escapeHtml(tab.id)}"
        ${isActive ? 'aria-current="page"' : ''}
      >
        <span class="nav-icon" aria-hidden="true">${tabIcons[tab.id]}</span>
        ${escapeHtml(label)}
      </button>
    `;
  }).join('');

  return `
    <nav class="bottom-nav" aria-label="${escapeHtml(translate('common.primaryNavigation'))}">
      ${items}
    </nav>
  `;
}
