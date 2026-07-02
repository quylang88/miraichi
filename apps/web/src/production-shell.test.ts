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
import type { LocalMatchStatus } from '@miraichi/shared';


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

describe('phase 9 cloud persistence workflows', () => {
  it('renders honest Bets loading, empty, unavailable, and durable record states', () => {
    expect(renderAppShell({ activeTabId: 'bets', betRecordsState: { status: 'loading' } })).toContain('data-bet-records-state="loading"');
    expect(renderAppShell({ activeTabId: 'bets', betRecordsState: { status: 'empty' } })).toContain('data-bet-records-state="empty"');
    expect(renderAppShell({ activeTabId: 'bets', betRecordsState: { status: 'unavailable', reason: 'Setup required' } })).toContain('Setup required');
    const html = renderAppShell({ activeTabId: 'bets', betRecordsState: { status: 'ready', drafts: [{ draftId: 'd1', matchGroupId: 'm1', marketType: '1X2', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, createdAt: '2026-07-02T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z' }], pending: [{ betId: 'b1', ownerProfileId: 'owner-primary', matchGroupId: 'm1', homeTeamName: 'Japan', awayTeamName: 'Vietnam', marketType: '1X2', selectionLabel: 'Japan', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, status: 'pending', createdAt: '2026-07-02T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z' }], settled: [] } });
    expect(html).toContain('Japan vs Vietnam');
    expect(html).toContain('data-delete-draft-confirm="d1"');
  });

  it('renders persisted Bankroll and backup controls without formula placeholders', () => {
    const html = renderAppShell({ activeTabId: 'bankroll', bankrollState: { status: 'ready', selectedAccountId: 'a', accounts: [{ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points', openingBalancePoints: 100, currentBalancePoints: 90, archived: false, createdAt: '2026-07-02T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z' }], ledger: [{ entryId: 'e', ownerProfileId: 'owner-primary', accountId: 'a', entryType: 'withdrawal', amountPoints: -10, occurredAt: '2026-07-02T00:00:00.000Z', createdAt: '2026-07-02T00:00:00.000Z' }] } });
    expect(html).toContain('90 pts');
    expect(html).toContain('data-ledger-type="deposit"');
    expect(html).toContain('data-ledger-type="withdrawal"');
    expect(html).toContain('data-ledger-type="transfer_out"');
    expect(html).toContain('data-ledger-type="correction"');
    expect(html).toContain('data-backup-export');
    expect(html).toContain('data-backup-import');
    expect(html).not.toContain('24,500 pts');
    expect(html).not.toContain('Formula status');
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
        snapshot: {
          snapshotId: 'test-snapshot',
          generatedAt: '2026-07-01T00:00:00.000Z',
          importedAt: '2026-07-01T00:00:00.000Z',
          matchCount: 1,
          competitions: [],
          sources: [],
          freshness: 'fresh' as const,
          warnings: []
        },
        matches: [
          {
            id: 'match-1',
            competition: {
              id: 'world-cup-2026',
              name: 'FIFA World Cup',
              type: 'national-team',
              season: '2026'
            },
            kickoffUtc: '2026-06-29T10:00:00.000Z',
            status: 'scheduled',
            homeTeam: { id: 'team-1', name: 'Japan' },
            awayTeam: { id: 'team-2', name: 'Vietnam' },
            score: { home: null, away: null },
            venue: 'Tokyo Stadium',
            sourceRefs: [],
            updatedAt: '2026-07-01T00:00:00.000Z'
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
    expect(html).toContain('data-bet-records-state');
    expect(html).toContain('data-backup-export');
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

  it('serves browser-imported config package modules in dev and static builds', () => {
    const serverSource = readFileSync(fileURLToPath(new URL('./index.ts', import.meta.url)), 'utf8');
    const staticBuildSource = readFileSync(fileURLToPath(new URL('../scripts/build-static.ts', import.meta.url)), 'utf8');
    const serviceWorkerSource = readFileSync(fileURLToPath(new URL('../public/service-worker.ts', import.meta.url)), 'utf8');

    expect(serverSource).toContain("url.startsWith('/packages/config/src/')");
    expect(serverSource).toContain('function resolveSourcePath');
    expect(serverSource).toContain('filePath = resolveSourcePath(url);');
    expect(staticBuildSource).toContain("'packages/config/src'");
    expect(serviceWorkerSource).toContain('/packages/config/src/competition-registry.mock.js');
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

  it('renders the Date Navigator and LIVE filter button on the matches panel', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'ready',
        date: '2026-06-30',
        warnings: [],
        snapshot: {
          snapshotId: 'test-snapshot',
          generatedAt: '2026-07-01T00:00:00.000Z',
          importedAt: '2026-07-01T00:00:00.000Z',
          matchCount: 0,
          competitions: [],
          sources: [],
          freshness: 'fresh' as const,
          warnings: []
        },
        matches: []
      }
    });

    expect(html).toContain('id="date-prev-btn"');
    expect(html).toContain('id="date-next-btn"');
    expect(html).toContain('id="date-picker-btn"');
    expect(html).toContain('id="date-picker-input"');
    expect(html).toContain('class="date-ribbon"');
    
    // It should render 5 dates centered around 2026-06-30:
    // 2026-06-28, 2026-06-29, 2026-06-30, 2026-07-01, 2026-07-02
    expect(html).toContain('data-date="2026-06-28"');
    expect(html).toContain('data-date="2026-06-29"');
    expect(html).toContain('data-date="2026-06-30"');
    expect(html).toContain('data-date="2026-07-01"');
    expect(html).toContain('data-date="2026-07-02"');

    // The center date should be active
    expect(html).toContain('class="date-chip active" type="button" data-date="2026-06-30"');

    // LIVE filter button should be rendered
    expect(html).toContain('id="live-filter-btn"');
    expect(html).toContain('LIVE</button>');
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

  it('supports timezone and display density settings', () => {
    const storage = createMemoryStorage();
    const settings = createSettingsService({ storage });

    // Verify defaults
    expect(settings.getSettings()).toMatchObject({
      timezone: 'local',
      displayDensity: 'standard'
    });

    // Test settings.setSetting('timezone', 'UTC')
    settings.setSetting('timezone', 'UTC');
    expect(settings.getSettings().timezone).toBe('UTC');

    // Test settings.setSetting('timezone', 'Asia/Ho_Chi_Minh')
    settings.setSetting('timezone', 'Asia/Ho_Chi_Minh');
    expect(settings.getSettings().timezone).toBe('Asia/Ho_Chi_Minh');

    // Verify invalid values are rejected
    expect(() => settings.setSetting('timezone', 'invalid-timezone')).toThrow();

    // Verify displayDensity works as well
    settings.setSetting('displayDensity', 'compact');
    expect(settings.getSettings().displayDensity).toBe('compact');

    expect(() => settings.setSetting('displayDensity', 'invalid-density')).toThrow();
  });

  it('respects timezone settings when rendering kickoff times in app shell', () => {
    const matchFeed = {
      status: 'ready' as const,
      date: '2026-06-29',
      warnings: [] as string[],
      snapshot: {
        snapshotId: 'test-snapshot',
        generatedAt: '2026-07-01T00:00:00.000Z',
        importedAt: '2026-07-01T00:00:00.000Z',
        matchCount: 1,
        competitions: [],
        sources: [],
        freshness: 'fresh' as const,
        warnings: []
      },
      matches: [
        {
          id: 'test-fixture-1',
          competition: {
            id: 'test-league',
            name: 'FIFA World Cup',
            type: 'national-team' as const,
            season: '2026'
          },
          kickoffUtc: '2026-06-29T10:00:00.000Z',
          status: 'scheduled' as const,
          homeTeam: { id: 'team-1', name: 'Japan' },
          awayTeam: { id: 'team-2', name: 'Vietnam' },
          score: { home: null, away: null },
          updatedAt: '2026-07-01T00:00:00.000Z',
          sourceRefs: []
        }
      ]
    };

    // For UTC timezone
    const htmlUtc = renderAppShell({
      activeTabId: 'today',
      translate: t,
      matchFeed,
      timezone: 'UTC'
    });
    expect(htmlUtc).toContain('Kickoff 10:00 UTC');

    // For Asia/Ho_Chi_Minh timezone (UTC+7)
    const htmlHcm = renderAppShell({
      activeTabId: 'today',
      translate: t,
      matchFeed,
      timezone: 'Asia/Ho_Chi_Minh'
    });
    expect(htmlHcm).toContain('Kickoff 17:00 Asia/Ho_Chi_Minh');
  });
});

describe('production shell live match feed rendering', () => {
  it('renders loading and unavailable states for local snapshot feed', () => {
    const loadingHtml = renderAppShell({
      activeTabId: 'today',
      translate: t,
      matchFeed: { status: 'loading', date: '2026-06-29' }
    });
    expect(loadingHtml).toContain('Loading match snapshot');

    const unavailableHtml = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'unavailable',
        date: '2026-06-29',
        reason: 'Local match snapshot is missing. Run the national-team data update before using match workflows.',
        warnings: ['local_snapshot_missing']
      }
    });
    expect(unavailableHtml).toContain('Data update required');
    expect(unavailableHtml).toContain('Local match snapshot is missing. Run the national-team data update before using match workflows.');
  });

  it('renders local snapshot matches and removes visible hardcoded live feed labels', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: {
        status: 'ready',
        date: '2026-06-29',
        warnings: [],
        snapshot: {
          snapshotId: 'test-snapshot',
          generatedAt: '2026-07-01T00:00:00.000Z',
          importedAt: '2026-07-01T00:00:00.000Z',
          matchCount: 1,
          competitions: [],
          sources: [],
          freshness: 'fresh' as const,
          warnings: []
        },
        matches: [
          {
            id: 'match-1',
            competition: {
              id: 'world-cup-2026',
              name: 'FIFA World Cup',
              type: 'national-team',
              season: '2026'
            },
            kickoffUtc: '2026-06-29T10:00:00.000Z',
            status: 'scheduled',
            homeTeam: { id: 'team-1', name: 'Japan' },
            awayTeam: { id: 'team-2', name: 'Vietnam' },
            score: { home: null, away: null },
            venue: 'Tokyo Stadium',
            sourceRefs: [],
            updatedAt: '2026-07-01T00:00:00.000Z'
          }
        ]
      }
    });

    expect(html).toContain('Japan vs Vietnam');
    expect(html).toContain('FIFA World Cup');
    expect(html).toContain('Local match ID match-1');
    expect(html).not.toContain('provider fixture context');
    expect(html).not.toContain('No provider matches');

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

describe('production shell entry match feed wiring', () => {
  it('loads match feed through the web service instead of hardcoded shell-only data', () => {
    const source = readFileSync(fileURLToPath(new URL('./shell-entry.ts', import.meta.url)), 'utf8');

    expect(source).toContain("import { getMatchFeed");
    expect(source).toContain("matchFeedState");
    expect(source).toContain("void refreshMatchFeed");
    expect(source).not.toContain("Team Alpha vs Team Beta");
  });
});

describe('production shell match filters panel', () => {
  const testMatchFeed = {
    status: 'ready' as const,
    date: '2026-06-30',
    warnings: [] as string[],
    snapshot: {
      snapshotId: 'test-snapshot',
      generatedAt: '2026-07-01T00:00:00.000Z',
      importedAt: '2026-07-01T00:00:00.000Z',
      matchCount: 3,
      competitions: [],
      sources: [],
      freshness: 'fresh' as const,
      warnings: []
    },
    matches: [
      {
        id: 'm1',
        competition: {
          id: 'c1',
          name: 'FIFA World Cup',
          type: 'national-team' as const,
          season: '2026'
        },
        kickoffUtc: '2026-06-30T14:00:00.000Z',
        status: 'scheduled' as const,
        homeTeam: { id: 't1', name: 'Japan' },
        awayTeam: { id: 't2', name: 'Vietnam' },
        score: { home: null, away: null },
        venue: 'Stadium A',
        sourceRefs: [],
        updatedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'm2',
        competition: {
          id: 'c2',
          name: 'English Premier League',
          type: 'national-team' as const,
          season: '2026'
        },
        kickoffUtc: '2026-06-30T16:00:00.000Z',
        status: 'in_play' as unknown as LocalMatchStatus,
        homeTeam: { id: 't3', name: 'Arsenal' },
        awayTeam: { id: 't4', name: 'Chelsea' },
        score: { home: 1, away: 0 },
        venue: 'Stadium B',
        sourceRefs: [],
        updatedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'm3',
        competition: {
          id: 'c3',
          name: 'Women Friendly',
          type: 'national-team' as const,
          season: '2026'
        },
        kickoffUtc: '2026-06-30T10:00:00.000Z',
        status: 'scheduled' as const,
        homeTeam: { id: 't5', name: 'USA Women' },
        awayTeam: { id: 't6', name: 'Germany' },
        score: { home: null, away: null },
        venue: 'Stadium C',
        sourceRefs: [],
        updatedAt: '2026-07-01T00:00:00.000Z'
      }
    ]
  };

  it('renders the filter panel with radio inputs and checkbox lists', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      isFilterPanelOpen: true,
      filters: {
        groupby: 'league',
        type: 'all',
        gender: 'all',
        selectedLeagues: new Set<string>()
      }
    });

    expect(html).toContain('id="matches-filter-panel"');
    expect(html).not.toContain('id="matches-filter-panel" hidden');
    expect(html).toContain('name="filter-groupby" value="league" checked');
    expect(html).toContain('name="filter-type" value="all" checked');
    expect(html).toContain('name="filter-gender" value="all" checked');
    
    // Check dynamic league checklist population
    expect(html).toContain('value="FIFA World Cup"');
    expect(html).toContain('value="English Premier League"');
    expect(html).toContain('value="Women Friendly"');
  });

  const getMatchesPanelHtml = (html: string) => {
    const start = html.indexOf('id="screen-matches"');
    const end = html.indexOf('</section>', start);
    return html.slice(start, end);
  };

  it('filters matches by LIVE state', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      isLiveFilterActive: true
    });
    const panel = getMatchesPanelHtml(html);

    expect(panel).toContain('Arsenal vs Chelsea');
    expect(panel).not.toContain('Japan vs Vietnam');
    expect(panel).not.toContain('USA Women vs Germany');
  });

  it('filters matches by search query', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      searchQuery: 'Japan'
    });
    const panel = getMatchesPanelHtml(html);

    expect(panel).toContain('Japan vs Vietnam');
    expect(panel).not.toContain('Arsenal vs Chelsea');
    expect(panel).not.toContain('USA Women vs Germany');
  });

  it('filters matches by competition type (national vs club)', () => {
    const htmlNational = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'national',
        gender: 'all',
        selectedLeagues: new Set<string>()
      }
    });
    const panelNational = getMatchesPanelHtml(htmlNational);
    expect(panelNational).toContain('Japan vs Vietnam'); // FIFA World Cup is national
    expect(panelNational).toContain('USA Women vs Germany'); // Women Friendly is national
    expect(panelNational).not.toContain('Arsenal vs Chelsea'); // English Premier League is club

    const htmlClub = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'club',
        gender: 'all',
        selectedLeagues: new Set<string>()
      }
    });
    const panelClub = getMatchesPanelHtml(htmlClub);
    expect(panelClub).not.toContain('Japan vs Vietnam');
    expect(panelClub).not.toContain('USA Women vs Germany');
    expect(panelClub).toContain('Arsenal vs Chelsea');
  });

  it('filters matches by gender (men vs women)', () => {
    const htmlWomen = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'all',
        gender: 'women',
        selectedLeagues: new Set<string>()
      }
    });
    const panelWomen = getMatchesPanelHtml(htmlWomen);
    expect(panelWomen).toContain('USA Women vs Germany');
    expect(panelWomen).not.toContain('Japan vs Vietnam');
    expect(panelWomen).not.toContain('Arsenal vs Chelsea');

    const htmlMen = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'all',
        gender: 'men',
        selectedLeagues: new Set<string>()
      }
    });
    const panelMen = getMatchesPanelHtml(htmlMen);
    expect(panelMen).not.toContain('USA Women vs Germany');
    expect(panelMen).toContain('Japan vs Vietnam');
    expect(panelMen).toContain('Arsenal vs Chelsea');
  });

  it('filters matches by selected leagues', () => {
    const htmlLeagues = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'all',
        gender: 'all',
        selectedLeagues: new Set<string>(['English Premier League', 'FIFA World Cup'])
      }
    });
    const panelLeagues = getMatchesPanelHtml(htmlLeagues);
    expect(panelLeagues).toContain('Japan vs Vietnam');
    expect(panelLeagues).toContain('Arsenal vs Chelsea');
    expect(panelLeagues).not.toContain('USA Women vs Germany');
  });

  it('groups matches by league and sorts by kickoff time when groupby is time', () => {
    const htmlTime = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'time',
        type: 'all',
        gender: 'all',
        selectedLeagues: new Set<string>()
      }
    });
    
    // When grouped by time, there is only one date group header, e.g. "2026-06-30"
    expect(htmlTime).toContain('<div class="group-label">2026-06-30</div>');
    // Ensure all matches are rendered
    expect(htmlTime).toContain('USA Women vs Germany');
    expect(htmlTime).toContain('Japan vs Vietnam');
    expect(htmlTime).toContain('Arsenal vs Chelsea');

    const htmlLeague = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      filters: {
        groupby: 'league',
        type: 'all',
        gender: 'all',
        selectedLeagues: new Set<string>()
      }
    });
    // When grouped by league, there are league group headers:
    expect(htmlLeague).toContain('<div class="group-label">FIFA World Cup</div>');
    expect(htmlLeague).toContain('<div class="group-label">English Premier League</div>');
    expect(htmlLeague).toContain('<div class="group-label">Women Friendly</div>');
  });

  it('renders matches empty state when no matches match filters', () => {
    const html = renderAppShell({
      activeTabId: 'matches',
      translate: t,
      matchFeed: testMatchFeed,
      searchQuery: 'NonExistentTeamName'
    });

    expect(html).toContain('style="display: block;"');
    expect(html).toContain('No local snapshot matches match the current filters.');
    expect(html).not.toContain('No provider matches');
  });
});
