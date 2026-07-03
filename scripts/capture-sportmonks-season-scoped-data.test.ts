import { describe, expect, it } from 'vitest';
import { parseSportmonksSeasonScopedCaptureArgs } from './capture-sportmonks-season-scoped-data.js';

describe('sportmonks season scoped capture CLI args', () => {
  it('parses league, season, endpoint, and max request controls', () => {
    expect(parseSportmonksSeasonScopedCaptureArgs([
      '--league-id=732',
      '--league-id=720,717',
      '--season-id=26618',
      '--endpoint=schedules.bySeasonId',
      '--endpoint=standings.bySeasonId',
      '--max-requests=10',
      '--no-skip-existing'
    ])).toEqual({
      leagueIds: [732, 720, 717],
      seasonIds: [26618],
      endpoints: ['schedules.bySeasonId', 'standings.bySeasonId'],
      maxRequests: 10,
      skipAlreadyCaptured: false
    });
  });
});
