import { describe, expect, it } from 'vitest';
import { parseSportmonksLeagueCaptureArgs } from './capture-sportmonks-league-data.js';

describe('sportmonks league capture CLI', () => {
  it('parses league, repeated seasons/groups, limits, and recapture control', () => {
    expect(parseSportmonksLeagueCaptureArgs([
      '--league-id=8',
      '--season-id=2025',
      '--season-id=2024',
      '--max-seasons=2',
      '--group=fixture',
      '--group=team',
      '--max-requests=1000',
      '--no-skip-existing'
    ])).toEqual({
      leagueId: 8,
      seasonIds: [2025, 2024],
      maxSeasons: 2,
      groups: ['fixture', 'team'],
      maxRequests: 1000,
      skipExisting: false
    });
  });

  it('defaults to every non-live league group and rejects dry-run', () => {
    expect(parseSportmonksLeagueCaptureArgs(['--league-id=8'])).toEqual({
      leagueId: 8,
      seasonIds: [],
      groups: ['season', 'fixture', 'team', 'ai'],
      skipExisting: true
    });
    expect(() => parseSportmonksLeagueCaptureArgs(['--league-id=8', '--dry-run']))
      .toThrow('Unsupported Sportmonks league capture argument: --dry-run');
  });

  it('rejects missing league-id', () => {
    expect(() => parseSportmonksLeagueCaptureArgs([]))
      .toThrow('--league-id is required');
  });

  it('rejects invalid league-id', () => {
    expect(() => parseSportmonksLeagueCaptureArgs(['--league-id=0']))
      .toThrow('--league-id must be a positive integer');
    expect(() => parseSportmonksLeagueCaptureArgs(['--league-id=-5']))
      .toThrow('--league-id must be a positive integer');
  });

  it('rejects invalid group names', () => {
    expect(() => parseSportmonksLeagueCaptureArgs(['--league-id=8', '--group=live']))
      .toThrow('Invalid --group value: live');
  });

  it('rejects non-positive max-requests', () => {
    expect(() => parseSportmonksLeagueCaptureArgs(['--league-id=8', '--max-requests=0']))
      .toThrow('--max-requests must be a positive integer');
  });

  it('rejects non-positive max-seasons', () => {
    expect(() => parseSportmonksLeagueCaptureArgs(['--league-id=8', '--max-seasons=0']))
      .toThrow('--max-seasons must be a positive integer');
  });

  it('deduplicates season IDs while preserving order', () => {
    const result = parseSportmonksLeagueCaptureArgs(['--league-id=8', '--season-id=2025', '--season-id=2025', '--season-id=2024']);
    expect(result.seasonIds).toEqual([2025, 2024]);
  });
});
