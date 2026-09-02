import { describe, expect, it } from 'vitest';
import type { LocalMatch, LocalMatchDetail } from '@miraichi/shared';
import { renderMatchDetailView } from './match-detail-view.js';
import { createTranslator, getCatalogKeys } from '../services/i18n-service.js';

const match: LocalMatch = {
  id: 'match-1',
  competition: { id: 'custom-league', name: 'Custom League', type: 'club', season: '2026' },
  kickoffUtc: '2026-08-27T09:00:00.000Z',
  status: 'completed',
  homeTeam: { id: 'home-1', name: 'Home Club' },
  awayTeam: { id: 'away-1', name: 'Away Club' },
  score: { home: 2, away: 1 },
  sourceRefs: [{ sourceId: 'sportscore', importedAt: '2026-08-27T12:00:00.000Z' }],
  updatedAt: '2026-08-27T12:00:00.000Z'
};

function detail(overrides: Partial<LocalMatchDetail> = {}): LocalMatchDetail {
  return {
    match,
    status: 'completed',
    elapsedMinute: 90,
    events: [],
    teamStats: [
      { teamId: 'home-1', cornerKicks: null, yellowCards: 0, redCards: null, totalShots: null, shotsOnGoal: null, possessionPercentage: null, fouls: null, offsides: 0 },
      { teamId: 'away-1', cornerKicks: 0, yellowCards: null, redCards: null, totalShots: null, shotsOnGoal: null, possessionPercentage: null, fouls: 11, offsides: null }
    ],
    lineups: [
      { teamId: 'home-1', teamName: 'Home Club', formation: '4-3-3', starters: [{ name: 'Home Keeper', shirtNumber: 1, position: 'GK' }], substitutes: [] },
      { teamId: 'away-1', teamName: 'Away Club', formation: null, starters: [], substitutes: [] }
    ],
    updatedAt: '2026-08-27T12:00:00.000Z',
    ...overrides
  };
}

describe('factual match detail rendering', () => {
  it('renders pending and unavailable states without injecting provider attribution', () => {
    const translate = createTranslator('vi');
    const pending = renderMatchDetailView({ status: 'pending', match, retryAfterSeconds: 150 }, translate, 'vi', 'UTC');
    const unavailable = renderMatchDetailView({ status: 'unavailable', match, warnings: ['detail_refresh_timeout'] }, translate, 'vi', 'UTC');
    expect(pending).toContain('Đang lấy dữ liệu chi tiết');
    expect(unavailable).toContain('Chi tiết trận đấu không khả dụng');
    expect(`${pending}${unavailable}`).not.toContain('Powered by SportScore');
  });

  it('renders missing metrics and lineup coverage as unavailable while preserving explicit zeroes', () => {
    const html = renderMatchDetailView({ status: 'ready', detail: detail() }, createTranslator('vi'), 'vi', 'UTC');
    expect(html).toContain('Phạm lỗi');
    expect(html).toContain('Việt vị');
    expect(html).toContain('Đội hình');
    expect(html).toContain('4-3-3');
    expect(html).toContain('Home Keeper');
    expect(html).toContain('<td>–</td>');
    expect(html).toMatch(/<td>0<\/td>/u);
    expect(html).not.toContain('<td>null</td>');

    const empty = renderMatchDetailView({ status: 'ready', detail: detail({ lineups: [] }) }, createTranslator('en'), 'en', 'UTC');
    expect(empty).toContain('Lineups unavailable.');
  });

  it('keeps EN/VI parity for detail and live states', () => {
    const enKeys = getCatalogKeys('en');
    const viKeys = getCatalogKeys('vi');
    expect(enKeys).toEqual(viKeys);
    for (const key of [
      'detail.pendingRefresh', 'detail.unavailable', 'detail.noData', 'detail.stat.fouls',
      'detail.stat.offsides', 'detail.lineups', 'detail.formation', 'detail.starters',
      'detail.substitutes', 'live.title', 'live.partial', 'live.stale'
    ]) {
      expect(enKeys).toContain(key);
      expect(viKeys).toContain(key);
    }
  });
});
