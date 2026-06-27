import { describe, expect, it, vi } from 'vitest';
import {
  PRODUCTION_NAVIGATION_TAB_IDS,
  getNavigationTabById,
  navigationTabs
} from './config/navigation-tabs.js';
import { renderAppShell } from './components/app-shell.js';
import { renderBottomNavigation } from './components/bottom-navigation.js';
import { createSettingsService } from './services/settings-service.js';
import { resolveLocale, t } from './services/i18n-service.js';

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));

  return {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => {
      store.clear();
    }),
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key) ?? null : null)),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    })
  };
}

describe('production PWA shell configuration', () => {
  it('uses the accepted five-tab domain navigation backbone only', () => {
    expect(PRODUCTION_NAVIGATION_TAB_IDS).toEqual([
      'today',
      'matches',
      'bets',
      'bankroll',
      'miraichi'
    ]);
    expect(navigationTabs.map((tab) => tab.id)).toEqual(PRODUCTION_NAVIGATION_TAB_IDS);
    expect(navigationTabs).toHaveLength(5);
    expect(navigationTabs.map((tab) => tab.id)).not.toContain('settings');
    expect(navigationTabs.map((tab) => tab.id)).not.toContain('add');
  });

  it('looks up stable tab metadata without inventing routes', () => {
    expect(getNavigationTabById('bets')).toMatchObject({
      id: 'bets',
      labelKey: 'nav.bets'
    });
    expect(getNavigationTabById('settings')).toBeNull();
  });
});

describe('production PWA shell rendering', () => {
  it('renders the production app shell with bottom navigation and all tab panels', () => {
    const html = renderAppShell({ activeTabId: 'today', translate: t });

    expect(html).toContain('data-production-shell="phase-5-9"');
    expect(html).toContain('data-preview-parity="black-apple-ledger"');
    expect(html).toContain('data-shell-tab-panel="today"');
    expect(html).toContain('data-shell-tab-panel="matches"');
    expect(html).toContain('data-shell-tab-panel="bets"');
    expect(html).toContain('data-shell-tab-panel="bankroll"');
    expect(html).toContain('data-shell-tab-panel="miraichi"');
    expect(html).toContain('data-settings-entry="miraichi-tab"');
    expect(html).not.toContain('data-primary-tab="settings"');
    expect(html).not.toContain('data-primary-tab="add"');
  });

  it('keeps production visually and structurally aligned with the accepted preview shell', () => {
    const html = renderAppShell({ activeTabId: 'today', translate: t });

    expect(html).toContain('class="top-bar"');
    expect(html).toContain('class="notice"');
    expect(html).toContain('class="main-scroll"');
    expect(html).toContain('class="screen active" id="screen-today"');
    expect(html).toContain('class="summary-list"');
    expect(html).toContain('class="segmented"');
    expect(html).toContain('class="match-card" data-match-card');
    expect(html).toContain('id="screen-match-detail"');
    expect(html).toContain('data-open-match');
    expect(html).toContain('data-open-scoped-add');
    expect(html).toContain('data-open-edit');
    expect(html).toContain('data-review-only');
    expect(html).toContain('class="sheet-backdrop"');
    expect(html).toContain('class="sheet" id="add-sheet"');
    expect(html).toContain('id="match-summary-readonly"');
    expect(html).not.toContain('id="match-field"');
    expect(html).not.toContain('data-primary-add');
  });

  it('renders accessible bottom navigation buttons with the active tab marked', () => {
    const html = renderBottomNavigation({
      activeTabId: 'bets',
      tabs: navigationTabs,
      translate: t
    });

    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('type="button"');
    expect(html).toContain('class="nav-item active"');
    expect(html).toContain('data-tab-target="bets"');
    expect(html).toContain('data-screen="bets"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Bets');
  });
});

describe('production shell settings and i18n boundaries', () => {
  it('detects Vietnamese from browser locale and otherwise falls back to English', () => {
    expect(resolveLocale({ navigatorLanguages: ['vi-VN', 'en-US'] })).toBe('vi');
    expect(resolveLocale({ navigatorLanguages: ['ja-JP'] })).toBe('en');
    expect(resolveLocale({ storedLocale: 'en', navigatorLanguages: ['vi-VN'] })).toBe('en');
  });

  it('stores only tiny shell settings and rejects betting history persistence', () => {
    const storage = createMemoryStorage();
    const settings = createSettingsService({ storage, navigatorLanguages: ['vi-VN'] });

    expect(settings.getSettings()).toMatchObject({
      locale: 'vi',
      theme: 'dark',
      displayDensity: 'standard'
    });

    settings.setSetting('locale', 'en');
    expect(settings.getSettings().locale).toBe('en');

    expect(() => settings.setSetting('bettingHistory', [])).toThrow(
      'Unsupported shell setting key: bettingHistory'
    );
    expect(storage.setItem).not.toHaveBeenCalledWith(
      expect.stringContaining('betting-history'),
      expect.any(String)
    );
  });

  it('keeps translation lookups as a fallback-first stub', () => {
    expect(t('nav.today', 'Today')).toBe('Today');
    expect(t('settings.language', 'Language')).toBe('Language');
  });
});
