import { describe, expect, it } from 'vitest';
import { buildSportmonksLeagueCaptureRequests } from './league-capture-plan.js';

describe('sportmonks league capture request graph', () => {
  it('builds scoped season, fixture, team, and AI requests only', () => {
    const requests = buildSportmonksLeagueCaptureRequests({
      leagueId: 8,
      seasons: [{ seasonId: 2025, name: '2025/2026' }],
      fixtureIds: [100],
      teamIds: [1],
      teamSeasons: [{ teamId: 1, seasonId: 2025 }]
    });

    expect(requests.map((item) => [item.endpointKey, item.urlPath])).toEqual(expect.arrayContaining([
      ['schedules.bySeasonId', '/schedules/seasons/2025'],
      ['topscorers.bySeasonId', '/topscorers/seasons/2025'],
      ['fixtures.enrichedById', '/fixtures/100'],
      ['odds.prematchByFixtureId', '/odds/pre-match/fixtures/100'],
      ['commentaries.byFixtureId', '/commentaries/fixtures/100'],
      ['squads.bySeasonAndTeamId', '/squads/seasons/2025/teams/1'],
      ['statistics.byTeamId', '/statistics/seasons/teams/1'],
      ['predictions.predictabilityByLeagueId', '/predictions/predictability/leagues/8'],
      ['predictions.probabilitiesByFixtureId', '/predictions/probabilities/fixtures/100'],
      ['predictions.valueBetsByFixtureId', '/predictions/value-bets/fixtures/100'],
      ['matchFacts.byLeagueId', '/match-facts/leagues/8']
    ]));

    // Must exclude forbidden endpoint families
    expect(requests.some((item) => item.urlPath.includes('/expected/lineups'))).toBe(false);
    expect(requests.some((item) => item.urlPath.includes('/inplay') || item.urlPath.includes('/livescores'))).toBe(false);
    expect(requests.some((item) => item.endpointKey.endsWith('.all'))).toBe(false);
  });

  it('groups season requests before fixture requests before team requests before ai requests', () => {
    const requests = buildSportmonksLeagueCaptureRequests({
      leagueId: 8,
      seasons: [{ seasonId: 2025 }],
      fixtureIds: [100],
      teamIds: [1],
      teamSeasons: [{ teamId: 1, seasonId: 2025 }]
    });

    const groups = requests.map((r) => r.group);
    const firstFixtureIdx = groups.indexOf('fixture');
    const lastSeasonIdx = groups.lastIndexOf('season');
    const firstTeamIdx = groups.indexOf('team');
    const firstAiIdx = groups.indexOf('ai');

    if (lastSeasonIdx !== -1 && firstFixtureIdx !== -1) {
      expect(lastSeasonIdx).toBeLessThan(firstFixtureIdx);
    }
    if (firstFixtureIdx !== -1 && firstTeamIdx !== -1) {
      expect(firstFixtureIdx).toBeLessThan(firstTeamIdx);
    }
    if (firstTeamIdx !== -1 && firstAiIdx !== -1) {
      expect(firstTeamIdx).toBeLessThan(firstAiIdx);
    }
  });

  it('returns only selected groups when groups filter is provided', () => {
    const requests = buildSportmonksLeagueCaptureRequests({
      leagueId: 8,
      seasons: [{ seasonId: 2025 }],
      fixtureIds: [100],
      teamIds: [1],
      teamSeasons: [{ teamId: 1, seasonId: 2025 }]
    }, ['season', 'fixture']);

    const groupSet = new Set(requests.map((r) => r.group));
    expect(groupSet.has('season')).toBe(true);
    expect(groupSet.has('fixture')).toBe(true);
    expect(groupSet.has('team')).toBe(false);
    expect(groupSet.has('ai')).toBe(false);
  });

  it('marks non-paginated endpoints correctly', () => {
    const requests = buildSportmonksLeagueCaptureRequests({
      leagueId: 8,
      seasons: [{ seasonId: 2025 }],
      fixtureIds: [100],
      teamIds: [1],
      teamSeasons: [{ teamId: 1, seasonId: 2025 }]
    });

    const nonPaginatedKeys = ['fixtures.enrichedById', 'commentaries.byFixtureId', 'squads.bySeasonAndTeamId'];
    for (const key of nonPaginatedKeys) {
      const req = requests.find((r) => r.endpointKey === key);
      if (req) {
        expect(req.paginated, `${key} should not be paginated`).toBe(false);
      }
    }

    // Paginated ones
    const paginatedKeys = ['schedules.bySeasonId', 'statistics.byTeamId'];
    for (const key of paginatedKeys) {
      const req = requests.find((r) => r.endpointKey === key);
      if (req) {
        expect(req.paginated, `${key} should be paginated`).toBe(true);
      }
    }
  });

  it('handles multiple seasons and teams with correct scoping', () => {
    const requests = buildSportmonksLeagueCaptureRequests({
      leagueId: 8,
      seasons: [{ seasonId: 2024 }, { seasonId: 2025 }],
      fixtureIds: [100, 101],
      teamIds: [1, 2],
      teamSeasons: [
        { teamId: 1, seasonId: 2024 },
        { teamId: 2, seasonId: 2025 }
      ]
    });

    const schedulePaths = requests.filter((r) => r.endpointKey === 'schedules.bySeasonId').map((r) => r.urlPath);
    expect(schedulePaths).toContain('/schedules/seasons/2024');
    expect(schedulePaths).toContain('/schedules/seasons/2025');

    const fixturePaths = requests.filter((r) => r.endpointKey === 'fixtures.enrichedById').map((r) => r.urlPath);
    expect(fixturePaths).toContain('/fixtures/100');
    expect(fixturePaths).toContain('/fixtures/101');

    // squads.bySeasonAndTeamId must be cross-product of teamSeasons
    const squadPaths = requests.filter((r) => r.endpointKey === 'squads.bySeasonAndTeamId').map((r) => r.urlPath);
    expect(squadPaths).toContain('/squads/seasons/2024/teams/1');
    expect(squadPaths).toContain('/squads/seasons/2025/teams/2');
  });

  it('creates team statistics once per team instead of once per team-season pair', () => {
    const requests = buildSportmonksLeagueCaptureRequests({
      leagueId: 8,
      seasons: [{ seasonId: 2024 }, { seasonId: 2025 }],
      fixtureIds: [],
      teamIds: [1],
      teamSeasons: [
        { teamId: 1, seasonId: 2024 },
        { teamId: 1, seasonId: 2025 }
      ]
    }, ['team']);

    expect(requests.filter((request) => request.endpointKey === 'statistics.byTeamId')).toHaveLength(1);
  });
});
