import { describe, expect, it, vi } from 'vitest';
import {
  PRODUCTION_NAVIGATION_TAB_IDS,
  getNavigationTabById,
  navigationTabs
} from './config/navigation-tabs.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderAppShell } from './components/app-shell.js';
import { renderBottomNavigation } from './components/bottom-navigation.js';
import { createSettingsService } from './services/settings-service.js';
import { resolveLocale, t } from './services/i18n-service.js';
import { getTodayDateTileParts } from './components/app-shell.js';

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
    expect(html).toContain('data-production-baseline="black-apple-ledger"');
    expect(html).toContain('data-shell-tab-panel="today"');
    expect(html).toContain('data-shell-tab-panel="matches"');
    expect(html).toContain('data-shell-tab-panel="bets"');
    expect(html).toContain('data-shell-tab-panel="bankroll"');
    expect(html).toContain('data-shell-tab-panel="miraichi"');
    expect(html).toContain('data-settings-entry="miraichi-tab"');
    expect(html).not.toContain('data-primary-tab="settings"');
    expect(html).not.toContain('data-primary-tab="add"');
  });

  it('keeps production aligned with the accepted Black Apple Ledger shell structure', () => {
    const html = renderAppShell({
      activeTabId: 'today',
      translate: t,
      matchFeed: {
        status: 'ready',
        date: '2026-06-29',
        warnings: [],
        matches: [
          {
            id: 'api-football-fixture-1',
            sourceProviderId: 'api-football',
            providerFixtureId: '1',
            competitionId: 'api-football-league-1',
            competitionName: 'FIFA World Cup',
            seasonId: 'api-football-season-2026',
            round: 'Group Stage - 1',
            status: 'scheduled',
            statusLabel: 'Not Started',
            kickoffTime: '2026-06-29T10:00:00.000Z',
            homeTeam: { id: 'api-football-team-1', name: 'Japan' },
            awayTeam: { id: 'api-football-team-2', name: 'Vietnam' },
            score: null,
            venueName: 'Tokyo Stadium',
            elapsedMinute: null
          }
        ]
      }
    });

    expect(html).not.toContain('class="top-bar"');
    expect(html).not.toContain('class="notice"');
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

  it('renders the current date in the Today header without phase labels', () => {
    const html = renderAppShell({ activeTabId: 'today', translate: t });
    const today = getTodayDateTileParts();

    expect(html).toContain(`aria-label="Current date ${today.day} ${today.month}"`);
    expect(html).toContain(`<span class="date-day">${today.day}</span>`);
    expect(html).toContain(`<span class="date-month">${today.month}</span>`);
    expect(html).not.toContain('5.9');
    expect(html).not.toContain('PWA</span>');
  });

  it('removes the redundant choose-match-to-add action from the Bets tab', () => {
    const html = renderAppShell({ activeTabId: 'bets', translate: t });

    expect(html).not.toContain('Choose Match to Add');
  });

  it('does not render detail copy under primary tab titles', () => {
    const html = renderAppShell({ activeTabId: 'today', translate: t });

    expect(html).not.toContain('Quick snapshot for points, matches, and market context.');
    expect(html).not.toContain('Generic fixtures grouped for manual tracking.');
    expect(html).not.toContain('Manage ongoing, draft, and settled mock records.');
    expect(html).not.toContain('Static point snapshot for layout review.');
    expect(html).not.toContain('Context inbox for future review workflows.');
  });

  it('keeps production as the only served web shell route', () => {
    const serverSource = readFileSync(fileURLToPath(new URL('./index.ts', import.meta.url)), 'utf8');

    expect(serverSource).not.toContain('/preview');
    expect(serverSource).not.toContain('preview.html');
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

  it('uses a stadium-style icon for the Matches tab', () => {
    const html = renderBottomNavigation({
      activeTabId: 'matches',
      tabs: navigationTabs,
      translate: t
    });

    expect(html).toContain('data-icon="stadium"');
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

describe('production shell live match feed rendering', () => {
  it('renders loading and unavailable states for API-Football feed', () => {
    const loadingHtml = renderAppShell({
      activeTabId: 'today',
      translate: t,
      matchFeed: { status: 'loading', date: '2026-06-29' }
    });
    expect(loadingHtml).toContain('Loading match feed');

    const unavailableHtml = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'unavailable',
        date: '2026-06-29',
        reason: 'API_FOOTBALL_KEY is required for API-Football match feed.',
        warnings: ['api_football_key_missing']
      }
    });
    expect(unavailableHtml).toContain('Provider setup required');
    expect(unavailableHtml).toContain('API_FOOTBALL_KEY is required for API-Football match feed.');
  });

  it('renders real provider matches and removes visible hardcoded live feed labels', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'ready',
        date: '2026-06-29',
        warnings: [],
        matches: [
          {
            id: 'api-football-fixture-1',
            sourceProviderId: 'api-football',
            providerFixtureId: '1',
            competitionId: 'api-football-league-1',
            competitionName: 'FIFA World Cup',
            seasonId: 'api-football-season-2026',
            round: 'Group Stage - 1',
            status: 'scheduled',
            statusLabel: 'Not Started',
            kickoffTime: '2026-06-29T10:00:00.000Z',
            homeTeam: { id: 'api-football-team-1', name: 'Japan' },
            awayTeam: { id: 'api-football-team-2', name: 'Vietnam' },
            score: null,
            venueName: 'Tokyo Stadium',
            elapsedMinute: null
          }
        ]
      }
    });

    expect(html).toContain('Japan vs Vietnam');
    expect(html).toContain('FIFA World Cup');

    const todayPanelStart = html.indexOf('id="screen-today"');
    const todayPanelEnd = html.indexOf('</section>', todayPanelStart);
    const todayPanelHtml = html.slice(todayPanelStart, todayPanelEnd);

    const matchesPanelStart = html.indexOf('id="screen-matches"');
    const matchesPanelEnd = html.indexOf('</section>', matchesPanelStart);
    const matchesPanelHtml = html.slice(matchesPanelStart, matchesPanelEnd);

    expect(todayPanelHtml).not.toContain('Team Alpha vs Team Beta');
    expect(todayPanelHtml).not.toContain('Team Gamma vs Team Delta');
    expect(matchesPanelHtml).not.toContain('Team Alpha vs Team Beta');
    expect(matchesPanelHtml).not.toContain('Team Gamma vs Team Delta');
  });
});
