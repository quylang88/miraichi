import { describe, expect, it } from 'vitest';
import type { LocalMatch, LocalMatchDetail } from '@miraichi/shared';
import { renderMatchDetailView } from './match-detail-view.js';
import {
  hasSportScoreEvidence,
  renderSportScoreAttribution
} from './source-attribution.js';
import { renderMatchesScreen } from './screens/matches-screen.js';
import { renderTodayScreen } from './screens/today-screen.js';
import { createTranslator, getCatalogKeys } from '../services/i18n-service.js';
import type { MatchFeedViewState } from '../services/match-feed-service.js';

const sportScoreRef = {
  sourceId: 'sportscore' as const,
  importedAt: '2026-08-27T12:00:00.000Z'
};

const completedMatch: LocalMatch = {
  id: 'match-1',
  competition: { id: 'custom-league', name: 'Custom League', type: 'club', season: '2026' },
  kickoffUtc: '2026-08-27T09:00:00.000Z',
  status: 'completed',
  homeTeam: { id: 'home-1', name: 'Home Club' },
  awayTeam: { id: 'away-1', name: 'Away Club' },
  score: { home: 2, away: 1 },
  sourceRefs: [sportScoreRef],
  updatedAt: '2026-08-27T12:00:00.000Z'
};

function feed(freshness: 'fresh' | 'stale' | 'missing' = 'fresh'): MatchFeedViewState {
  return {
    status: freshness === 'missing' ? 'unavailable' : 'ready',
    date: '2026-08-27',
    ...(freshness === 'missing' ? { reason: 'missing' } : { matches: [completedMatch] }),
    warnings: [],
    snapshot: {
      snapshotId: 'snapshot-1',
      generatedAt: '2026-08-27T12:00:00.000Z',
      importedAt: '2026-08-27T12:00:00.000Z',
      matchCount: 1,
      competitions: [],
      sources: [sportScoreRef],
      freshness,
      warnings: []
    }
  } as MatchFeedViewState;
}

function detail(overrides: Partial<LocalMatchDetail> = {}): LocalMatchDetail {
  return {
    match: completedMatch,
    status: 'completed',
    elapsedMinute: 90,
    events: [],
    teamStats: [
      {
        teamId: 'home-1',
        cornerKicks: null,
        yellowCards: 0,
        redCards: null,
        totalShots: null,
        shotsOnGoal: null,
        possessionPercentage: null,
        fouls: null,
        offsides: 0
      },
      {
        teamId: 'away-1',
        cornerKicks: 0,
        yellowCards: null,
        redCards: null,
        totalShots: null,
        shotsOnGoal: null,
        possessionPercentage: null,
        fouls: 11,
        offsides: null
      }
    ],
    lineups: [
      {
        teamId: 'home-1',
        teamName: 'Home Club',
        formation: '4-3-3',
        starters: [{ name: 'Home Keeper', shirtNumber: 1, position: 'GK' }],
        substitutes: []
      },
      {
        teamId: 'away-1',
        teamName: 'Away Club',
        formation: null,
        starters: [],
        substitutes: []
      }
    ],
    updatedAt: '2026-08-27T12:00:00.000Z',
    ...overrides
  };
}

const inertTodayDependencies = {
  bets: { status: 'empty' as const },
  bankroll: { status: 'empty' as const },
  discipline: { status: 'unavailable' as const, code: 'test' },
  report: { status: 'unavailable' as const, code: 'test' }
};

describe('SportScore attribution and owner-facing source states', () => {
  it('renders one visible crawlable dofollow link only with SportScore evidence', () => {
    expect(hasSportScoreEvidence([sportScoreRef])).toBe(true);
    expect(hasSportScoreEvidence([{ sourceId: 'manual-snapshot', importedAt: sportScoreRef.importedAt }])).toBe(false);

    const html = renderSportScoreAttribution([sportScoreRef], createTranslator('en'));
    expect(html).toContain('data-source-attribution="sportscore"');
    expect(html).toContain('<a href="https://sportscore.com/">Powered by SportScore</a>');
    expect(html).not.toMatch(/rel=["'][^"']*nofollow/iu);
    expect(renderSportScoreAttribution([], createTranslator('en'))).toBe('');
  });

  it('shows attribution on Today and Matches only when the rendered snapshot has SportScore evidence', () => {
    const translate = createTranslator('en');
    const today = renderTodayScreen({
      activeTabId: 'today',
      translate,
      matchFeed: feed('fresh'),
      ...inertTodayDependencies
    });
    const matches = renderMatchesScreen({
      activeTabId: 'matches',
      translate,
      locale: 'en',
      matchFeed: feed('stale'),
      timezone: 'UTC',
      filters: { groupby: 'league', type: 'all', gender: 'all', selectedLeagues: new Set() },
      searchQuery: '',
      isFilterPanelOpen: false
    });

    expect(today).toContain('data-today-match-source-status="fresh"');
    expect(today).toContain('Powered by SportScore');
    expect(matches).not.toContain('Data status: Stale');
    expect(matches).toContain('Powered by SportScore');

    const freshMatches = renderMatchesScreen({
      activeTabId: 'matches',
      translate,
      locale: 'en',
      matchFeed: feed('fresh'),
      timezone: 'UTC',
      filters: { groupby: 'league', type: 'all', gender: 'all', selectedLeagues: new Set() },
      searchQuery: '',
      isFilterPanelOpen: false
    });
    expect(freshMatches).not.toContain('Data status: Fresh');
    expect(freshMatches).toContain('Powered by SportScore');

    const manualOnly = renderTodayScreen({
      activeTabId: 'today',
      translate,
      matchFeed: {
        ...feed('fresh'),
        snapshot: { ...(feed('fresh') as Extract<MatchFeedViewState, { status: 'ready' }>).snapshot, sources: [] },
        matches: [{ ...completedMatch, sourceRefs: [{ sourceId: 'manual-snapshot', importedAt: sportScoreRef.importedAt }] }]
      } as MatchFeedViewState,
      ...inertTodayDependencies
    });
    expect(manualOnly).toContain('data-today-match-source-status="fresh"');
    expect(manualOnly).not.toContain('Powered by SportScore');

    const unavailableWithoutSource = renderTodayScreen({
      activeTabId: 'today',
      translate,
      matchFeed: {
        status: 'unavailable',
        date: '2026-08-27',
        reason: 'No serving snapshot',
        warnings: ['serving_match_store_missing']
      },
      ...inertTodayDependencies
    });
    expect(unavailableWithoutSource).toContain('data-today-match-source-status="unavailable"');
    expect(unavailableWithoutSource).toContain('Unavailable');
    expect(unavailableWithoutSource).not.toContain('Powered by SportScore');
  });

  it('shows attribution for ready, pending, and unavailable detail when the displayed match is SportScore-derived', () => {
    const translate = createTranslator('vi');
    const ready = renderMatchDetailView({ status: 'ready', detail: detail() }, translate, 'vi', 'UTC');
    const pending = renderMatchDetailView({
      status: 'pending',
      match: completedMatch,
      retryAfterSeconds: 150
    }, translate, 'vi', 'UTC');
    const unavailable = renderMatchDetailView({
      status: 'unavailable',
      match: completedMatch,
      warnings: ['detail_refresh_timeout']
    }, translate, 'vi', 'UTC');

    expect(ready).toContain('Powered by SportScore');
    expect(pending).toContain('Đang lấy dữ liệu chi tiết');
    expect(pending).toContain('Powered by SportScore');
    expect(unavailable).toContain('Chi tiết trận đấu không khả dụng');
    expect(unavailable).toContain('Powered by SportScore');
  });

  it('renders missing metrics and lineup coverage as unavailable while preserving explicit zeroes', () => {
    const html = renderMatchDetailView(
      { status: 'ready', detail: detail() },
      createTranslator('vi'),
      'vi',
      'UTC'
    );

    expect(html).toContain('Phạm lỗi');
    expect(html).toContain('Việt vị');
    expect(html).toContain('Đội hình');
    expect(html).toContain('4-3-3');
    expect(html).toContain('Home Keeper');
    expect(html).toContain('<td>–</td>');
    expect(html).toMatch(/<td>0<\/td>/u);
    expect(html).not.toContain('<td>null</td>');

    const emptyLineups = renderMatchDetailView(
      { status: 'ready', detail: detail({ lineups: [] }) },
      createTranslator('en'),
      'en',
      'UTC'
    );
    expect(emptyLineups).toContain('Lineups unavailable.');
  });

  it('keeps EN/VI parity for attribution, freshness, pending, unavailable, and added detail copy', () => {
    const enKeys = getCatalogKeys('en');
    const viKeys = getCatalogKeys('vi');
    expect(enKeys).toEqual(viKeys);
    for (const key of [
      'source.sportscoreAttribution',
      'source.matchData',
      'source.fresh',
      'source.stale',
      'source.unavailable',
      'source.updatedAt',
      'detail.pendingRefresh',
      'detail.unavailable',
      'detail.noData',
      'detail.stat.fouls',
      'detail.stat.offsides',
      'detail.lineups',
      'detail.formation',
      'detail.starters',
      'detail.substitutes'
    ]) {
      expect(enKeys).toContain(key);
      expect(viKeys).toContain(key);
    }
  });
});
