import { describe, expect, it } from 'vitest';
import type { LocalMatch, LocalMatchDetail } from '@miraichi/shared';
import { renderMatchesScreen, renderMatchDetailScreen } from './matches-screen.js';
import { renderMatchDetailView } from '../match-detail-view.js';
import { createTranslator } from '../../services/i18n-service.js';
import type { MatchFeedViewState } from '../../services/match-feed-service.js';

const mockPremierLeagueMatch: LocalMatch = {
  id: 'match-epl-1',
  competition: { id: 'eng-premier-league', name: 'Premier League', type: 'club', season: '2026-27' },
  kickoffUtc: '2026-09-02T19:00:00.000Z',
  status: 'scheduled',
  homeTeam: { id: 'arsenal', name: 'Arsenal' },
  awayTeam: { id: 'chelsea', name: 'Chelsea' },
  score: { home: null, away: null },
  sourceRefs: [],
  updatedAt: '2026-09-01T00:00:00.000Z'
};

const mockAustrianBundesligaMatch: LocalMatch = {
  id: 'match-aut-1',
  competition: { id: 'aut-bundesliga', name: 'Austrian Bundesliga', type: 'club', season: '2026-27' },
  kickoffUtc: '2026-09-02T17:30:00.000Z',
  status: 'scheduled',
  homeTeam: { id: 'wolfsberger', name: 'Wolfsberger AC' },
  awayTeam: { id: 'lask', name: 'LASK' },
  score: { home: null, away: null },
  sourceRefs: [],
  updatedAt: '2026-09-01T00:00:00.000Z'
};

const mockChampionsLeagueMatch: LocalMatch = {
  id: 'match-ucl-1',
  competition: { id: 'uefa-champions-league', name: 'UEFA Champions League', type: 'club', season: '2026-27' },
  kickoffUtc: '2026-09-02T20:00:00.000Z',
  status: 'scheduled',
  homeTeam: { id: 'real-madrid', name: 'Real Madrid' },
  awayTeam: { id: 'bayern', name: 'Bayern München' },
  score: { home: null, away: null },
  sourceRefs: [],
  updatedAt: '2026-09-01T00:00:00.000Z'
};

describe('matches screen UI refinements', () => {
  it('does not render Data status or Snapshot generated metadata bar on matches screen', () => {
    const translate = createTranslator('en');
    const feed: MatchFeedViewState = {
      status: 'ready',
      date: '2026-09-02',
      matches: [mockPremierLeagueMatch],
      warnings: [],
      snapshot: {
        snapshotId: 'test-snapshot',
        generatedAt: '2026-08-31T11:46:00.000Z',
        importedAt: '2026-08-31T11:46:00.000Z',
        matchCount: 1,
        competitions: [],
        sources: [],
        freshness: 'stale',
        warnings: []
      }
    };

    const html = renderMatchesScreen({
      activeTabId: 'matches',
      translate,
      locale: 'en',
      matchFeed: feed,
      timezone: 'UTC',
      filters: { groupby: 'league', type: 'all', gender: 'all', selectedLeagues: new Set() },
      searchQuery: '',
      isFilterPanelOpen: false
    });

    expect(html).not.toContain('Data status:');
    expect(html).not.toContain('Data status: Stale');
    expect(html).not.toContain('Snapshot generated:');
    expect(html).not.toContain('Aug 31, 2026');
  });

  it('does not render debug context section (Grouping key, matchGroupId, Entry rule) in match detail screen', () => {
    const translate = createTranslator('en');
    const html = renderMatchDetailScreen(translate);

    expect(html).not.toContain('Grouping key');
    expect(html).not.toContain('matchGroupId');
    expect(html).not.toContain('Entry rule');
    expect(html).not.toContain('Add through this match');
    expect(html).not.toContain('match-context');
  });

  it('sorts competition groups by popularity ranking by default instead of alphabetical', () => {
    const translate = createTranslator('en');
    // Austrian Bundesliga (alphabetically first 'A') vs Premier League ('P') vs UEFA Champions League ('U')
    // Popularity order: UEFA Champions League (1), Premier League (2), Austrian Bundesliga (35)
    const feed: MatchFeedViewState = {
      status: 'ready',
      date: '2026-09-02',
      matches: [mockAustrianBundesligaMatch, mockPremierLeagueMatch, mockChampionsLeagueMatch],
      warnings: [],
      snapshot: {
        snapshotId: 'test-snapshot',
        generatedAt: '2026-09-01T00:00:00.000Z',
        importedAt: '2026-09-01T00:00:00.000Z',
        matchCount: 3,
        competitions: [],
        sources: [],
        freshness: 'fresh',
        warnings: []
      }
    };

    const html = renderMatchesScreen({
      activeTabId: 'matches',
      translate,
      locale: 'en',
      matchFeed: feed,
      timezone: 'UTC',
      filters: { groupby: 'league', type: 'all', gender: 'all', selectedLeagues: new Set() },
      searchQuery: '',
      isFilterPanelOpen: false
    });

    const uclPos = html.indexOf('UEFA Champions League');
    const eplPos = html.indexOf('Premier League');
    const autPos = html.indexOf('Austrian Bundesliga');

    expect(uclPos).toBeGreaterThan(-1);
    expect(eplPos).toBeGreaterThan(-1);
    expect(autPos).toBeGreaterThan(-1);

    // UCL (rank 1) should appear before EPL (rank 2), which appears before Austrian Bundesliga (rank 35)
    expect(uclPos).toBeLessThan(eplPos);
    expect(eplPos).toBeLessThan(autPos);
  });
});

describe('match detail view business formatting', () => {
  it('renders scheduled match score as vs and displays clean dash for unavailable info', () => {
    const translate = createTranslator('en');
    const scheduledDetail: LocalMatchDetail = {
      match: mockAustrianBundesligaMatch,
      status: 'scheduled',
      elapsedMinute: null,
      events: [],
      referee: null,
      warnings: [],
      updatedAt: '2026-09-01T00:00:00.000Z'
    };

    const html = renderMatchDetailView(
      { status: 'ready', detail: scheduledDetail },
      translate,
      'en',
      'UTC'
    );

    // Scoreline for scheduled match should show 'vs', not 'Unavailable – Unavailable'
    expect(html).toContain('Wolfsberger AC');
    expect(html).toContain('LASK');
    expect(html).toContain('<strong>vs</strong>');
    expect(html).not.toContain('Unavailable – Unavailable');

    // Elapsed, venue, referee should display '–' rather than 'Unavailable'
    expect(html).toContain('<dd>–</dd>');
    expect(html).not.toContain('<dd>Unavailable</dd>');
  });

  it('renders completed match with real scoreline', () => {
    const translate = createTranslator('en');
    const completedDetail: LocalMatchDetail = {
      match: {
        ...mockAustrianBundesligaMatch,
        status: 'completed',
        score: { home: 2, away: 1 }
      },
      status: 'completed',
      elapsedMinute: 90,
      events: [],
      referee: 'John Doe',
      warnings: [],
      updatedAt: '2026-09-01T00:00:00.000Z'
    };

    const html = renderMatchDetailView(
      { status: 'ready', detail: completedDetail },
      translate,
      'en',
      'UTC'
    );

    expect(html).toContain('<strong>2 – 1</strong>');
    expect(html).toContain('90&#39;');
    expect(html).toContain('John Doe');
  });
});

describe('timezone date partitioning', () => {
  it('correctly determines match calendar date across 00:00 midnight based on user timezone', async () => {
    const { getLocalDateFromUtc } = await import('@miraichi/shared');
    // Match at 19:30 UTC on 2026-08-31
    const kickoffUtc = '2026-08-31T19:30:00.000Z';

    // In UTC, date is 2026-08-31
    expect(getLocalDateFromUtc(kickoffUtc, 'UTC')).toBe('2026-08-31');

    // In Asia/Ho_Chi_Minh (UTC+7, 02:30 AM), date is 2026-09-01
    expect(getLocalDateFromUtc(kickoffUtc, 'Asia/Ho_Chi_Minh')).toBe('2026-09-01');

    // Match at 16:59:59 UTC on 2026-08-31 is 23:59:59 on Aug 31 in Asia/Ho_Chi_Minh
    expect(getLocalDateFromUtc('2026-08-31T16:59:59.000Z', 'Asia/Ho_Chi_Minh')).toBe('2026-08-31');

    // Match at 17:00:00 UTC on 2026-08-31 is 00:00:00 on Sept 1 in Asia/Ho_Chi_Minh
    expect(getLocalDateFromUtc('2026-08-31T17:00:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('2026-09-01');
  });
});
